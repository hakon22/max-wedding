import moment from 'moment-timezone';
import { Input } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';
import { Container, Singleton } from 'typescript-ioc';

import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { BaseService } from '@server/services/app/base-service';
import { GuestSubmissionExcelService } from '@server/services/guest/guest-submission-excel.service';
import { TelegramUserService } from '@server/services/telegram/telegram-user.service';
import { TELEGRAM_BOT_COMMANDS_FOR_ADMINS } from '@server/telegram/telegram-bot-command-menu';
import { DRINK_LABELS, MAIN_COURSE_LABELS } from '@shared/guest-menu-codes';

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const yesNoRu = (value: boolean): string => (value ? 'да ✅' : 'нет ❌');

const adminBlockSep = '\n\n';

/** Дата/время для сообщений админам (как в логах сервера) */
const formatCreatedRu = (date: Date): string =>
  moment(date).tz('Europe/Moscow').format('DD.MM.YYYY HH:mm');

/**
 * Регистрация команд свадебного бота
 */
@Singleton
export class TelegramWeddingBotCommandsService extends BaseService {
  private readonly tag = 'TelegramWeddingBotCommandsService';

  private readonly telegramUserService = Container.get(TelegramUserService);

  private readonly guestSubmissionExcelService = Container.get(GuestSubmissionExcelService);

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

    bot.command('list', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
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
            .map((guestSubmission) => this.formatSubmissionShort(guestSubmission))
            .join(`${adminBlockSep}<i>· · · · · · · · · ·</i>${adminBlockSep}`)
        );
      });
    });

    bot.command('last', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
        const [lastGuestSubmission] = await this.databaseService
          .getDataSource()
          .getRepository(GuestSubmissionEntity)
          .find({ relations: ['drinks'], order: { id: 'DESC' }, take: 1 });
        if (!lastGuestSubmission) {
          return '<i>Заявок нет.</i>';
        }
        return this.formatSubmissionFull(lastGuestSubmission);
      });
    });

    bot.command('summary', async (context) => {
      await this.runAdminCommand(context, bot, async () => {
        const dataSource = this.databaseService.getDataSource();
        const guestSubmissionRepository = dataSource.getRepository(GuestSubmissionEntity);
        const entityManager = dataSource.manager;
        const totalSubmissionCount = await guestSubmissionRepository.count();
        const mainCourseCountRows = await guestSubmissionRepository
          .createQueryBuilder('guestSubmission')
          .select('guestSubmission.mainCourseCode', 'mainCourseCode')
          .addSelect('COUNT(*)', 'submissionCount')
          .groupBy('guestSubmission.mainCourseCode')
          .getRawMany<{ mainCourseCode: string; submissionCount: string }>();
        const drinkCountRows = await entityManager
          .createQueryBuilder(GuestSubmissionDrinkEntity, 'guestSubmissionDrink')
          .innerJoin('guestSubmissionDrink.submission', 'guestSubmission')
          .select('guestSubmissionDrink.drinkCode', 'drinkCode')
          .addSelect('COUNT(*)', 'submissionCount')
          .where('guestSubmission.deleted IS NULL')
          .groupBy('guestSubmissionDrink.drinkCode')
          .orderBy('COUNT(*)', 'DESC')
          .getRawMany<{ drinkCode: string; submissionCount: string }>();
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
                MAIN_COURSE_LABELS[
                  mainCourseCountRow.mainCourseCode as keyof typeof MAIN_COURSE_LABELS
                ] ?? mainCourseCountRow.mainCourseCode,
              )} — <code>${mainCourseCountRow.submissionCount}</code>`,
          ),
          '',
          '<b>По напиткам</b>',
          ...drinkCountRows.map(
            (drinkCountRow) =>
              `  ▸ ${escapeHtml(
                DRINK_LABELS[drinkCountRow.drinkCode as keyof typeof DRINK_LABELS] ?? drinkCountRow.drinkCode,
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
      await spinner.finish(text, { parse_mode: 'HTML' });
    } catch (error) {
      this.loggerService.error(this.tag, 'admin command', error);
      await context.reply('Ошибка при выполнении команды.');
    }
  };

  private formatSubmissionShort = (guestSubmission: GuestSubmissionEntity): string => {
    const drinkLabelsJoined =
      guestSubmission.drinks
        ?.map(
          (guestSubmissionDrink) =>
            DRINK_LABELS[guestSubmissionDrink.drinkCode as keyof typeof DRINK_LABELS] ??
            guestSubmissionDrink.drinkCode,
        )
        .join(', ') ?? '—';
    const mainCourseLabel =
      MAIN_COURSE_LABELS[guestSubmission.mainCourseCode as keyof typeof MAIN_COURSE_LABELS] ??
      guestSubmission.mainCourseCode;
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

  private formatSubmissionFull = (guestSubmission: GuestSubmissionEntity): string => {
    const drinkLabelsJoined =
      guestSubmission.drinks
        ?.map(
          (guestSubmissionDrink) =>
            DRINK_LABELS[guestSubmissionDrink.drinkCode as keyof typeof DRINK_LABELS] ??
            guestSubmissionDrink.drinkCode,
        )
        .join(', ') ?? '—';
    const mainCourseLabel =
      MAIN_COURSE_LABELS[guestSubmission.mainCourseCode as keyof typeof MAIN_COURSE_LABELS] ??
      guestSubmission.mainCourseCode;
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

    const finish = async (finalText: string, extra?: { parse_mode?: 'HTML' }): Promise<void> => {
      stop();
      const opts = { parse_mode: extra?.parse_mode };
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
