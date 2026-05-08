import moment from 'moment-timezone';
import { Input, Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';
import { Container, Singleton } from 'typescript-ioc';

import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { BaseService } from '@server/services/app/base-service';
import { GuestSubmissionExcelService } from '@server/services/guest/guest-submission-excel.service';
import { MenuCatalogService, MenuCatalogValidationError } from '@server/services/menu/menu-catalog.service';
import { TelegramUserService } from '@server/services/telegram/telegram-user.service';
import { TELEGRAM_BOT_COMMANDS_FOR_ADMINS } from '@server/telegram/telegram-bot-command-menu';
import type { MenuItemKind } from '@shared/menu-catalog';

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const yesNoRu = (value: boolean): string => (value ? 'да ✅' : 'нет ❌');

const adminBlockSep = '\n\n';
const MENU_PAGE_SIZE = 5;

type MenuLabelMaps = {
  mainCourseLabelById: Record<number, string>;
  drinkLabelById: Record<number, string>;
};

type MenuDraft = {
  mode: 'create';
  kind: MenuItemKind;
  step: 'labelRu' | 'order' | 'confirm';
  labelRu: string;
  order: number;
  actionKey?: string;
};

type InlineReplyMarkup = ReturnType<typeof Markup.inlineKeyboard>['reply_markup'];

/** Дата/время для сообщений админам (как в логах сервера) */
const formatCreatedRu = (date: Date): string =>
  moment(date).tz('Europe/Moscow').format('DD.MM.YYYY HH:mm');

/**
 * Регистрация команд свадебного бота
 */
@Singleton
export class TelegramWeddingBotCommandsService extends BaseService {
  private getMiniAppAdminUrl = (): string | null => {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
    if (!appBaseUrl) {
      return null;
    }
    return `${appBaseUrl}/tg-miniapp/menu-admin`;
  };

  private readonly tag = 'TelegramWeddingBotCommandsService';

  private readonly telegramUserService = Container.get(TelegramUserService);

  private readonly guestSubmissionExcelService = Container.get(GuestSubmissionExcelService);

  private readonly menuCatalogService = Container.get(MenuCatalogService);

  private readonly menuDraftByTelegramId = new Map<string, MenuDraft>();

  /**
   * Подключение обработчиков к экземпляру Telegraf после его создания
   */
  public registerBot = (bot: Telegraf<Context>): void => {
    bot.start(async (context) => {
      try {
        if (!this.databaseService.getDataSource().isInitialized) {
          await context.reply('База данных не готова.');
          return;
        }
        const user = await this.telegramUserService.ensureUserFromContext(context);
        if (this.telegramUserService.isActiveAdmin(user)) {
          const telegramUserId = context.from?.id;
          if (telegramUserId !== undefined) {
            await context.telegram
              .setMyCommands([...TELEGRAM_BOT_COMMANDS_FOR_ADMINS], {
                scope: { type: 'chat', chat_id: telegramUserId },
              })
              .catch(() => undefined);
          }
          await context.reply(
            [
              '🤵‍♂️💍 <b>Админ-бот свадьбы</b>',
              '',
              '<b>Команды</b>',
              '• /miniapp — открыть Mini App редактор меню',
              '• /menu — редактор меню прямо в чате (резервное меню)',
              '• /list — последние заявки',
              '• /last — последняя заявка',
              '• /summary — сводка',
              '• /export — Excel',
            ].join('\n'),
            { parse_mode: 'HTML' },
          );
          return;
        }
        const site = process.env.NEXT_PUBLIC_APP_URL;
        if (!site) {
          await context.reply('Сайт не настроен. Попробуйте позже.');
          return;
        }
        await context.reply(`Здравствуйте! Подробности и анкета гостя на сайте: ${site}`);
      } catch (error) {
        this.loggerService.error(this.tag, 'start', error);
        await context.reply('Произошла ошибка. Попробуйте позже.');
      }
    });

    bot.command('menu', async (context) => {
      await this.runAdminCommand(context, bot, async () => this.buildAdminMenuRootText(), {
        replyMarkup: this.getMenuRootKeyboard().reply_markup,
      });
    });

    bot.command('miniapp', async (context) => {
      try {
        if (!this.databaseService.getDataSource().isInitialized) {
          await context.reply('База не готова');
          return;
        }
        const user = await this.telegramUserService.ensureUserFromContext(context);
        if (!this.telegramUserService.isActiveAdmin(user)) {
          await context.reply('Нет прав. Доступ только для администраторов (роль ADMIN в базе).');
          return;
        }
        const miniAppUrl = this.getMiniAppAdminUrl();
        if (!miniAppUrl) {
          await context.reply('Mini App URL не настроен. Укажите NEXT_PUBLIC_APP_URL.');
          return;
        }
        await context.reply(
          [
            '📱 <b>Mini App редактор меню</b>',
            '',
            'Нажмите кнопку ниже — она откроет приложение в режиме WebApp.',
            '',
            'Важно: не открывайте Mini App тапом по обычной ссылке, используйте именно кнопку.',
          ].join('\n'),
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: '📱 Открыть Mini App', web_app: { url: miniAppUrl } }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        this.loggerService.error(this.tag, 'miniapp', error);
        await context.reply('Ошибка при открытии Mini App.');
      }
    });

    bot.action(/^menu:(.+)$/u, async (context) => {
      const telegramId = context.from?.id?.toString();
      if (!telegramId) {
        return;
      }
      await context.answerCbQuery().catch(() => undefined);
      const user = await this.telegramUserService.ensureUserFromContext(context);
      if (!this.telegramUserService.isActiveAdmin(user)) {
        await context.reply('Нет прав. Доступ только для администраторов (роль ADMIN в базе).');
        return;
      }
      const actionData = context.match[1] ?? '';
      await this.handleMenuAction(context, actionData);
    });

    bot.on('text', async (context, next) => {
      const text = context.message.text;
      if (!text || text.startsWith('/')) {
        await next();
        return;
      }
      const telegramId = context.from?.id?.toString();
      if (!telegramId) {
        await next();
        return;
      }
      const draft = this.menuDraftByTelegramId.get(telegramId);
      if (!draft) {
        await next();
        return;
      }
      const user = await this.telegramUserService.ensureUserFromContext(context);
      if (!this.telegramUserService.isActiveAdmin(user)) {
        this.menuDraftByTelegramId.delete(telegramId);
        await context.reply('Нет прав. Доступ только для администраторов (роль ADMIN в базе).');
        return;
      }
      await this.handleMenuDraftInput(context, draft, text);
    });

    bot.command('list', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
        const labelMaps = await this.menuCatalogService.getLabelMaps();
        const recentGuestSubmissions = await this.databaseService
          .getDataSource()
          .getRepository(GuestSubmissionEntity)
          .find({ relations: ['drinks'], order: { id: 'DESC' }, take: 10 });
        if (recentGuestSubmissions.length === 0) {
          return '<i>Заявок пока нет.</i>';
        }
        return (
          '<b>Последние заявки</b> <i>(до 10)</i>\n' +
          recentGuestSubmissions
            .map((guestSubmission) => this.formatSubmissionShort(guestSubmission, labelMaps))
            .join(`${adminBlockSep}<i>· · · · · · · · · ·</i>${adminBlockSep}`)
        );
      });
    });

    bot.command('last', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
        const labelMaps = await this.menuCatalogService.getLabelMaps();
        const [lastGuestSubmission] = await this.databaseService
          .getDataSource()
          .getRepository(GuestSubmissionEntity)
          .find({ relations: ['drinks'], order: { id: 'DESC' }, take: 1 });
        if (!lastGuestSubmission) {
          return '<i>Заявок нет.</i>';
        }
        return this.formatSubmissionFull(lastGuestSubmission, labelMaps);
      });
    });

    bot.command('summary', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
        const labelMaps = await this.menuCatalogService.getLabelMaps();
        const dataSource = this.databaseService.getDataSource();
        const guestSubmissionRepository = dataSource.getRepository(GuestSubmissionEntity);
        const entityManager = dataSource.manager;
        const totalSubmissionCount = await guestSubmissionRepository.count();
        const mainCourseCountRows = await guestSubmissionRepository
          .createQueryBuilder('guestSubmission')
          .select('guestSubmission.mainCourseId', 'mainCourseId')
          .addSelect('COUNT(*)', 'submissionCount')
          .where('guestSubmission.mainCourseId IS NOT NULL')
          .andWhere('guestSubmission.deleted IS NULL')
          .groupBy('guestSubmission.mainCourseId')
          .getRawMany<{ mainCourseId: string; submissionCount: string }>();
        const drinkCountRows = await entityManager
          .createQueryBuilder(GuestSubmissionDrinkEntity, 'guestSubmissionDrink')
          .innerJoin('guestSubmissionDrink.submission', 'guestSubmission')
          .select('guestSubmissionDrink.drinkId', 'drinkId')
          .addSelect('COUNT(*)', 'submissionCount')
          .where('guestSubmission.deleted IS NULL')
          .groupBy('guestSubmissionDrink.drinkId')
          .orderBy('COUNT(*)', 'DESC')
          .getRawMany<{ drinkId: string; submissionCount: string }>();
        const overnightSubmissionCount = await guestSubmissionRepository
          .createQueryBuilder('guestSubmission')
          .where('guestSubmission.needsOvernightStay = :needsOvernight', { needsOvernight: true })
          .getCount();
        const lines = [
          '📊 <b>Сводка по заявкам</b>',
          '',
          `<b>Всего заявок</b> <code>${totalSubmissionCount}</code>`,
          `<b>Ночлёг после мероприятия</b> <code>${overnightSubmissionCount}</code>`,
          '',
          '<b>По блюдам</b>',
          ...mainCourseCountRows.map(
            (mainCourseCountRow) =>
              `  ▸ ${escapeHtml(
                labelMaps.mainCourseLabelById[Number(mainCourseCountRow.mainCourseId)] ??
                  `ID ${mainCourseCountRow.mainCourseId}`,
              )} — <code>${mainCourseCountRow.submissionCount}</code>`,
          ),
          '',
          '<b>По напиткам</b>',
          ...drinkCountRows.map(
            (drinkCountRow) =>
              `  ▸ ${escapeHtml(
                labelMaps.drinkLabelById[Number(drinkCountRow.drinkId)] ?? `ID ${drinkCountRow.drinkId}`,
              )} — <code>${drinkCountRow.submissionCount}</code>`,
          ),
        ];
        return lines.join('\n');
      });
    });

    bot.command('export', async (context) => {
      const telegramId = context.from?.id?.toString();
      if (!telegramId) {
        return;
      }
      try {
        if (!this.databaseService.getDataSource().isInitialized) {
          await context.reply('База не готова');
          return;
        }
        const user = await this.telegramUserService.ensureUserFromContext(context);
        if (!this.telegramUserService.isActiveAdmin(user)) {
          await context.reply('Нет прав. Доступ только для администраторов (роль ADMIN в базе).');
          return;
        }
        const spinner = await this.createSpinner(bot, telegramId, 'Собираю Excel');
        try {
          const workbookBuffer = await this.guestSubmissionExcelService.buildSubmissionsWorkbookBuffer();
          const exportFileName = `wedding-submissions-${new Date().toISOString().slice(0, 10)}.xlsx`;
          await spinner.finish('Готово — отправляю файл.');
          await bot.telegram.sendDocument(telegramId, Input.fromBuffer(workbookBuffer, exportFileName), {
            caption: 'Экспорт заявок',
          });
        } catch (error) {
          this.loggerService.error(this.tag, 'export', error);
          await spinner.finish('Не удалось сформировать файл. Смотрите лог сервера.');
        }
      } catch (error) {
        this.loggerService.error(this.tag, 'export outer', error);
        await context.reply('Ошибка при выполнении команды.');
      }
    });
  };

  private runAdminCommand = async (
    context: Context,
    bot: Telegraf<Context>,
    buildText: () => Promise<string>,
    options?: { replyMarkup?: InlineReplyMarkup },
  ): Promise<void> => {
    const telegramId = context.from?.id?.toString();
    if (!telegramId) {
      return;
    }
    try {
      if (!this.databaseService.getDataSource().isInitialized) {
        await context.reply('База не готова');
        return;
      }
      const user = await this.telegramUserService.ensureUserFromContext(context);
      if (!this.telegramUserService.isActiveAdmin(user)) {
        await context.reply('Нет прав. Доступ только для администраторов (роль ADMIN в базе).');
        return;
      }
      const spinner = await this.createSpinner(bot, telegramId, 'Загружаю данные');
      const text = await buildText();
      await spinner.finish(text, { parse_mode: 'HTML', replyMarkup: options?.replyMarkup });
    } catch (error) {
      this.loggerService.error(this.tag, 'admin command', error);
      await context.reply('Ошибка при выполнении команды.');
    }
  };

  private formatSubmissionShort = (guestSubmission: GuestSubmissionEntity, labelMaps: MenuLabelMaps): string => {
    const drinkLabelsJoined =
      guestSubmission.drinks
        ?.map(
          (guestSubmissionDrink) =>
            labelMaps.drinkLabelById[guestSubmissionDrink.drinkId] ?? `ID ${guestSubmissionDrink.drinkId}`,
        )
        .join(', ') ?? '—';
    const mainCourseLabel =
      guestSubmission.mainCourseId != null
        ? labelMaps.mainCourseLabelById[guestSubmission.mainCourseId] ?? `ID ${guestSubmission.mainCourseId}`
        : '—';
    const name = escapeHtml(guestSubmission.guestName ?? '—');
    const course = escapeHtml(mainCourseLabel);
    const drinks = escapeHtml(drinkLabelsJoined);
    return (
      `<b>#${guestSubmission.id}</b> · ${name}\n` +
      `<i>Присутствует:</i> ${yesNoRu(guestSubmission.plansToAttend)}\n` +
      `${course} · ${drinks}\n` +
      `<i>Ночлёг:</i> ${yesNoRu(guestSubmission.needsOvernightStay)}\n` +
      `<b>Создано</b>\n<code>${escapeHtml(formatCreatedRu(guestSubmission.created))}</code>`
    );
  };

  private formatSubmissionFull = (guestSubmission: GuestSubmissionEntity, labelMaps: MenuLabelMaps): string => {
    const drinkLabelsJoined =
      guestSubmission.drinks
        ?.map(
          (guestSubmissionDrink) =>
            labelMaps.drinkLabelById[guestSubmissionDrink.drinkId] ?? `ID ${guestSubmissionDrink.drinkId}`,
        )
        .join(', ') ?? '—';
    const mainCourseLabel =
      guestSubmission.mainCourseId != null
        ? labelMaps.mainCourseLabelById[guestSubmission.mainCourseId] ?? `ID ${guestSubmission.mainCourseId}`
        : '—';
    const identity =
      `<b>Заявка</b> <code>#${guestSubmission.id}</code>` +
      adminBlockSep +
      `<b>Имя гостя</b>\n${escapeHtml(guestSubmission.guestName ?? '—')}` +
      adminBlockSep +
      `<b>Планирует присутствовать</b>\n${yesNoRu(guestSubmission.plansToAttend)}`;

    const menu = [
      '<b>Блюдо</b>',
      escapeHtml(mainCourseLabel),
      '',
      '<b>Напитки</b>',
      escapeHtml(drinkLabelsJoined),
      '',
      `<b>С детьми</b> ${yesNoRu(guestSubmission.withChildren)}`,
      `<b>Ночлёг после мероприятия</b> ${yesNoRu(guestSubmission.needsOvernightStay)}`,
    ].join('\n');

    const commentBody = guestSubmission.message?.trim()
      ? escapeHtml(guestSubmission.message)
      : '<i>—</i>';
    const comment = `${adminBlockSep}<b>Комментарий</b>\n${commentBody}`;

    const meta = `${adminBlockSep}<b>Создано</b>\n<code>${escapeHtml(formatCreatedRu(guestSubmission.created))}</code>`;

    return `${identity}${adminBlockSep}${menu}${comment}${meta}`;
  };

  private kindTitle = (kind: MenuItemKind): string => (kind === 'mainCourse' ? 'Основные блюда' : 'Напитки');

  private kindCode = (kind: MenuItemKind): string => (kind === 'mainCourse' ? 'main' : 'drink');

  private kindFromCode = (kindCode: string): MenuItemKind | null => {
    if (kindCode === 'main') {
      return 'mainCourse';
    }
    if (kindCode === 'drink') {
      return 'drink';
    }
    return null;
  };

  private getMenuRootKeyboard = () => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🍽 Основные блюда', 'menu:kind:main')],
      [Markup.button.callback('🥂 Напитки', 'menu:kind:drink')],
    ]);
  };

  private getKindMenuKeyboard = (kind: MenuItemKind) => {
    const kindCode = this.kindCode(kind);
    return Markup.inlineKeyboard([
      [Markup.button.callback('📋 Список', `menu:list:${kindCode}:0`)],
      [Markup.button.callback('➕ Создать', `menu:create:${kindCode}`)],
      [Markup.button.callback('✏️ Редактировать', `menu:editpick:${kindCode}:0`)],
      [Markup.button.callback('⬅️ Назад', 'menu:root')],
    ]);
  };

  private buildAdminMenuRootText = async (): Promise<string> => {
    const catalog = await this.menuCatalogService.listCatalog(false);
    return [
      '🍽 <b>Редактор меню</b>',
      '',
      `Основные блюда: <code>${catalog.mainCourses.length}</code>`,
      `Напитки: <code>${catalog.drinks.length}</code>`,
      '',
      'Выберите раздел:',
    ]
      .filter(Boolean)
      .join('\n');
  };

  private renderMenuList = async (
    kind: MenuItemKind,
    page: number,
  ): Promise<{ text: string; markup: InlineReplyMarkup }> => {
    const rows = await this.menuCatalogService.listByKind(kind, false);
    const totalPages = Math.max(1, Math.ceil(rows.length / MENU_PAGE_SIZE));
    const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
    const startIndex = clampedPage * MENU_PAGE_SIZE;
    const slice = rows.slice(startIndex, startIndex + MENU_PAGE_SIZE);
    const header = `📋 <b>${this.kindTitle(kind)}</b> · стр. ${clampedPage + 1}/${totalPages}`;
    const body =
      slice.length === 0
        ? '<i>Список пуст.</i>'
        : slice.map((row, index) => {
          const status = row.isActive ? '<b>активно ✅</b>' : '<i>выключено ⛔️</i>';
          return (
            `${startIndex + index + 1}. <b>${escapeHtml(row.labelRu)}</b>\n` +
            `   EN: ${escapeHtml(row.labelEn)}\n` +
            `   Порядок: <code>${row.order}</code> · ${status}`
          );
        }).join('\n\n');
    const kindCode = this.kindCode(kind);
    const markup = Markup.inlineKeyboard([
      [
        Markup.button.callback('<<', `menu:list:${kindCode}:0`),
        Markup.button.callback('<', `menu:list:${kindCode}:${Math.max(0, clampedPage - 1)}`),
        Markup.button.callback('>', `menu:list:${kindCode}:${Math.min(totalPages - 1, clampedPage + 1)}`),
        Markup.button.callback('>>', `menu:list:${kindCode}:${Math.max(0, totalPages - 1)}`),
      ],
      [Markup.button.callback('⬅️ Раздел', `menu:kind:${kindCode}`)],
    ]);
    return { text: `${header}\n\n${body}`, markup: markup.reply_markup };
  };

  private renderEditPicker = async (
    kind: MenuItemKind,
    page: number,
  ): Promise<{ text: string; markup: InlineReplyMarkup }> => {
    const rows = await this.menuCatalogService.listByKind(kind, false);
    const totalPages = Math.max(1, Math.ceil(rows.length / MENU_PAGE_SIZE));
    const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
    const startIndex = clampedPage * MENU_PAGE_SIZE;
    const slice = rows.slice(startIndex, startIndex + MENU_PAGE_SIZE);
    const kindCode = this.kindCode(kind);
    const rowButtons = slice.map((row, index) => [
      Markup.button.callback(
        `${startIndex + index + 1}. ${row.labelRu}`,
        `menu:edit:${kindCode}:${row.id}`,
      ),
    ]);
    const markup = Markup.inlineKeyboard([
      ...rowButtons,
      [
        Markup.button.callback('<', `menu:editpick:${kindCode}:${Math.max(0, clampedPage - 1)}`),
        Markup.button.callback('>', `menu:editpick:${kindCode}:${Math.min(totalPages - 1, clampedPage + 1)}`),
      ],
      [Markup.button.callback('⬅️ Раздел', `menu:kind:${kindCode}`)],
    ]);
    return {
      text: `✏️ <b>${this.kindTitle(kind)}</b>\nВыберите позицию для редактирования. Стр. ${clampedPage + 1}/${totalPages}`,
      markup: markup.reply_markup,
    };
  };

  private renderEditCard = async (
    kind: MenuItemKind,
    id: number,
  ): Promise<{ text: string; markup: InlineReplyMarkup }> => {
    const rows = await this.menuCatalogService.listByKind(kind, false);
    const row = rows.find((item) => item.id === id);
    if (!row) {
      throw new MenuCatalogValidationError('Позиция не найдена');
    }
    const kindCode = this.kindCode(kind);
    const markup = Markup.inlineKeyboard([
      [Markup.button.callback('Изменить название', `menu:field:${kindCode}:${id}:labelRu`)],
      [Markup.button.callback('Изменить порядок', `menu:field:${kindCode}:${id}:order`)],
      [Markup.button.callback(row.isActive ? 'Выключить ⛔️' : 'Включить ✅', `menu:toggle:${kindCode}:${id}`)],
      [Markup.button.callback('Удалить 🗑', `menu:deleteask:${kindCode}:${id}`)],
      [Markup.button.callback('⬅️ К списку', `menu:editpick:${kindCode}:0`)],
    ]);
    return {
      text: [
        `✏️ <b>${this.kindTitle(kind)}</b>`,
        '',
        `<b>ID</b>: <code>${row.id}</code>`,
        `<b>Название на русском</b>: ${escapeHtml(row.labelRu)}`,
        `<b>Название на английском</b>: ${escapeHtml(row.labelEn)}`,
        `<b>Порядок</b>: <code>${row.order}</code>`,
        `<b>Статус</b>: ${row.isActive ? 'активно ✅' : 'выключено ⛔️'}`,
      ].join('\n'),
      markup: markup.reply_markup,
    };
  };

  private updateMenuMessage = async (
    context: Context,
    text: string,
    markup?: InlineReplyMarkup,
  ): Promise<void> => {
    if (context.callbackQuery && 'message' in context.callbackQuery && context.callbackQuery.message) {
      await context
        .editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: markup,
        })
        .catch(async () => {
          await context.reply(text, {
            parse_mode: 'HTML',
            reply_markup: markup,
          });
        });
      return;
    }
    await context.reply(text, { parse_mode: 'HTML', reply_markup: markup });
  };

  private handleMenuAction = async (context: Context, actionData: string): Promise<void> => {
    const telegramId = context.from?.id?.toString();
    if (!telegramId) {
      return;
    }
    const chunks = actionData.split(':');
    const command = chunks[0] ?? '';
    try {
      if (command === 'root') {
        this.menuDraftByTelegramId.delete(telegramId);
        await this.updateMenuMessage(context, await this.buildAdminMenuRootText(), this.getMenuRootKeyboard().reply_markup);
        return;
      }
      if (command === 'kind') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        if (!kind) {
          throw new MenuCatalogValidationError('Неизвестный раздел меню');
        }
        this.menuDraftByTelegramId.delete(telegramId);
        await this.updateMenuMessage(
          context,
          `⚙️ <b>${this.kindTitle(kind)}</b>\nВыберите действие:`,
          this.getKindMenuKeyboard(kind).reply_markup,
        );
        return;
      }
      if (command === 'list') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        if (!kind) {
          throw new MenuCatalogValidationError('Неизвестный раздел меню');
        }
        const page = Number(chunks[2] ?? 0);
        const rendered = await this.renderMenuList(kind, Number.isFinite(page) ? page : 0);
        await this.updateMenuMessage(context, rendered.text, rendered.markup);
        return;
      }
      if (command === 'create') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        if (!kind) {
          throw new MenuCatalogValidationError('Неизвестный раздел меню');
        }
        this.menuDraftByTelegramId.set(telegramId, {
          mode: 'create',
          kind,
          step: 'labelRu',
          labelRu: '',
          order: 0,
        });
        await this.updateMenuMessage(
          context,
          `➕ <b>${this.kindTitle(kind)}</b>\nШаг 1/2: введите название на русском`,
          Markup.inlineKeyboard([[Markup.button.callback('Отмена', `menu:kind:${this.kindCode(kind)}`)]]).reply_markup,
        );
        return;
      }
      if (command === 'createconfirm') {
        const draft = this.menuDraftByTelegramId.get(telegramId);
        if (!draft || draft.step !== 'confirm') {
          throw new MenuCatalogValidationError('Нет черновика создания');
        }
        await this.menuCatalogService.createMenuItem(draft.kind, {
          labelRu: draft.labelRu,
          order: draft.order,
          isActive: true,
        });
        this.menuDraftByTelegramId.delete(telegramId);
        const rendered = await this.renderMenuList(draft.kind, 0);
        await this.updateMenuMessage(
          context,
          `✅ Позиция создана.\n\n${rendered.text}`,
          rendered.markup,
        );
        return;
      }
      if (command === 'createcancel') {
        const draft = this.menuDraftByTelegramId.get(telegramId);
        this.menuDraftByTelegramId.delete(telegramId);
        const kind = draft?.kind ?? 'mainCourse';
        await this.updateMenuMessage(
          context,
          'Создание отменено.',
          this.getKindMenuKeyboard(kind).reply_markup,
        );
        return;
      }
      if (command === 'editpick') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        if (!kind) {
          throw new MenuCatalogValidationError('Неизвестный раздел меню');
        }
        const page = Number(chunks[2] ?? 0);
        const rendered = await this.renderEditPicker(kind, Number.isFinite(page) ? page : 0);
        await this.updateMenuMessage(context, rendered.text, rendered.markup);
        return;
      }
      if (command === 'edit') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        const id = Number(chunks[2] ?? 0);
        if (!kind || !Number.isInteger(id)) {
          throw new MenuCatalogValidationError('Некорректный запрос');
        }
        const rendered = await this.renderEditCard(kind, id);
        await this.updateMenuMessage(context, rendered.text, rendered.markup);
        return;
      }
      if (command === 'field') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        const id = Number(chunks[2] ?? 0);
        const field = chunks[3] as 'labelRu' | 'order';
        if (!kind || !Number.isInteger(id) || !['labelRu', 'order'].includes(field)) {
          throw new MenuCatalogValidationError('Некорректный запрос');
        }
        this.menuDraftByTelegramId.delete(telegramId);
        await context.reply(
          `✏️ ${this.kindTitle(kind)} #${id}\nВведите новое значение:`,
          { parse_mode: 'HTML' },
        );
        this.menuDraftByTelegramId.set(telegramId, {
          mode: 'create',
          kind,
          step: 'confirm',
          labelRu: '',
          order: 0,
          actionKey: `${this.kindCode(kind)}:${id}:${field}`,
        });
        return;
      }
      if (command === 'toggle') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        const id = Number(chunks[2] ?? 0);
        if (!kind || !Number.isInteger(id)) {
          throw new MenuCatalogValidationError('Некорректный запрос');
        }
        await this.menuCatalogService.toggleMenuItemActive(kind, id);
        const rendered = await this.renderEditCard(kind, id);
        await this.updateMenuMessage(context, `✅ Статус обновлён.\n\n${rendered.text}`, rendered.markup);
        return;
      }
      if (command === 'deleteask') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        const id = Number(chunks[2] ?? 0);
        if (!kind || !Number.isInteger(id)) {
          throw new MenuCatalogValidationError('Некорректный запрос');
        }
        const kindCode = this.kindCode(kind);
        await this.updateMenuMessage(
          context,
          `Удалить позицию #${id}?`,
          Markup.inlineKeyboard([
            [Markup.button.callback('Да, удалить', `menu:delete:${kindCode}:${id}`)],
            [Markup.button.callback('Отмена', `menu:edit:${kindCode}:${id}`)],
          ]).reply_markup,
        );
        return;
      }
      if (command === 'delete') {
        const kind = this.kindFromCode(chunks[1] ?? '');
        const id = Number(chunks[2] ?? 0);
        if (!kind || !Number.isInteger(id)) {
          throw new MenuCatalogValidationError('Некорректный запрос');
        }
        await this.menuCatalogService.deleteMenuItem(kind, id);
        const rendered = await this.renderMenuList(kind, 0);
        await this.updateMenuMessage(
          context,
          `🗑 Позиция удалена.\n\n${rendered.text}`,
          rendered.markup,
        );
      }
    } catch (error) {
      if (error instanceof MenuCatalogValidationError) {
        await context.reply(`Ошибка: ${error.message}`);
        return;
      }
      this.loggerService.error(this.tag, 'menu action', error);
      await context.reply('Ошибка при обработке действия меню.');
    }
  };

  private handleMenuDraftInput = async (context: Context, draft: MenuDraft, text: string): Promise<void> => {
    const telegramId = context.from?.id?.toString();
    if (!telegramId) {
      return;
    }
    const value = text.trim();
    try {
      if (draft.actionKey && draft.step === 'confirm') {
        const [kindCode, idRaw, field] = draft.actionKey.split(':');
        const kind = this.kindFromCode(kindCode);
        const id = Number(idRaw);
        if (!kind || !Number.isInteger(id)) {
          throw new MenuCatalogValidationError('Некорректный черновик редактирования');
        }
        if (field === 'order') {
          const order = Number(value);
          if (!Number.isInteger(order) || order < 0) {
            throw new MenuCatalogValidationError('Порядок должен быть целым числом и не меньше 0');
          }
          await this.menuCatalogService.updateMenuItem(kind, id, { order });
        } else if (field === 'labelRu') {
          await this.menuCatalogService.updateMenuItem(kind, id, { [field]: value });
        } else {
          throw new MenuCatalogValidationError('Некорректное поле редактирования');
        }
        this.menuDraftByTelegramId.delete(telegramId);
        const rendered = await this.renderEditCard(kind, id);
        await context.reply(`✅ Значение обновлено.\n\n${rendered.text}`, {
          parse_mode: 'HTML',
          reply_markup: rendered.markup,
        });
        return;
      }

      if (draft.step === 'labelRu') {
        draft.labelRu = value;
        draft.step = 'order';
        this.menuDraftByTelegramId.set(telegramId, draft);
        await context.reply('Шаг 2/2: введите порядок отображения (целое число, начиная с 0)');
        return;
      }
      if (draft.step === 'order') {
        const order = Number(value);
        if (!Number.isInteger(order) || order < 0) {
          throw new MenuCatalogValidationError('Порядок должен быть целым числом и не меньше 0');
        }
        draft.order = order;
        draft.step = 'confirm';
        this.menuDraftByTelegramId.set(telegramId, draft);
        await context.reply(
          [
            'Проверьте данные:',
            `<b>Тип</b>: ${this.kindTitle(draft.kind)}`,
            `<b>Название на русском</b>: ${escapeHtml(draft.labelRu)}`,
            '<b>Название на английском</b>: <i>будет переведено автоматически</i>',
            `<b>Порядок</b>: <code>${draft.order}</code>`,
          ].join('\n'),
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('✅ Создать', 'menu:createconfirm')],
              [Markup.button.callback('❌ Отмена', 'menu:createcancel')],
            ]).reply_markup,
          },
        );
      }
    } catch (error) {
      if (error instanceof MenuCatalogValidationError) {
        await context.reply(`Ошибка: ${error.message}`);
        return;
      }
      this.loggerService.error(this.tag, 'menu draft input', error);
      await context.reply('Ошибка при обработке введённого значения.');
    }
  };

  /**
   * Спиннер: редактируемое сообщение с Braille-анимацией (как assistent-bot)
   */
  private createSpinner = async (bot: Telegraf<Context>, telegramId: string, baseText: string) => {
    let dotStep = 0;
    let messageId: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let label = baseText;

    const renderText = (): string => `⏳ ${DOTS[dotStep]}  ${label}…`;

    const sendInitial = async (): Promise<void> => {
      const sent = await bot.telegram
        .sendMessage(telegramId, renderText())
        .catch(() => undefined);
      messageId = sent?.message_id ?? null;
    };

    await sendInitial();

    if (messageId !== null) {
      timer = setInterval(() => {
        dotStep = (dotStep + 1) % DOTS.length;
        void bot.telegram.editMessageText(telegramId, messageId!, undefined, renderText()).catch(() => undefined);
      }, 3000);
    }

    const stop = (): void => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const updateText = async (newBase: string): Promise<void> => {
      label = newBase;
      if (messageId !== null) {
        await bot.telegram
          .editMessageText(telegramId, messageId, undefined, renderText())
          .catch(() => undefined);
      }
    };

    const finish = async (
      finalText: string,
      extra?: {
        parse_mode?: 'HTML';
        replyMarkup?: InlineReplyMarkup;
      },
    ): Promise<void> => {
      stop();
      const opts = {
        parse_mode: extra?.parse_mode,
        reply_markup: extra?.replyMarkup,
      };
      if (messageId !== null) {
        await bot.telegram
          .editMessageText(telegramId, messageId, undefined, finalText, opts)
          .catch(async () => {
            await bot.telegram.sendMessage(telegramId, finalText, opts);
          });
      } else {
        await bot.telegram.sendMessage(telegramId, finalText, opts);
      }
    };

    return { updateText, finish, stop };
  };
}
