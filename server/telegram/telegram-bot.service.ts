import type { Request, Response } from 'express';
import { type Context, Telegraf } from 'telegraf';
import { Container, Singleton } from 'typescript-ioc';

import { UserEntity, UserRoleEnum } from '@server/db/entities/user.entity';
import { BaseService } from '@server/services/app/base-service';
import { TelegramWeddingBotCommandsService } from '@server/services/telegram/telegram-wedding-bot-commands.service';
import {
  TELEGRAM_BOT_COMMANDS_FOR_ADMINS,
  TELEGRAM_BOT_COMMANDS_FOR_GUESTS,
} from '@server/telegram/telegram-bot-command-menu';
import { getTelegrafProxyOptions } from '@server/telegram/telegram-proxy.util';

@Singleton
export class TelegramBotService extends BaseService {
  private readonly tag = 'TelegramBotService';

  private bot: Telegraf<Context> | null = null;

  private readonly weddingBotCommands = Container.get(TelegramWeddingBotCommandsService);

  /**
   * Меню команд: по умолчанию только /start; для ADMIN — полный список (после перезапуска подхватит БД).
   */
  private syncMyCommandsWithDatabase = async (): Promise<void> => {
    if (!this.bot) {
      return;
    }
    const telegram = this.bot.telegram;
    await telegram.setMyCommands([...TELEGRAM_BOT_COMMANDS_FOR_GUESTS], { scope: { type: 'default' } });

    const dataSource = this.databaseService.getDataSource();
    if (!dataSource.isInitialized) {
      this.loggerService.warn(this.tag, 'БД не инициализирована — меню команд: только /start для всех');
      return;
    }

    const userRepository = dataSource.getRepository(UserEntity);
    const allUsersWithTelegram = await userRepository.find({ withDeleted: true });

    for (const user of allUsersWithTelegram) {
      const telegramUserId = Number(user.telegramId);
      if (!Number.isFinite(telegramUserId)) {
        continue;
      }
      /** В личке с ботом — scope `chat`, не `chat_member` (последний только для групп/супергрупп). */
      const privateChatScope = { type: 'chat' as const, chat_id: telegramUserId };
      const isActiveAdmin = !user.deleted && user.role === UserRoleEnum.ADMIN;
      if (isActiveAdmin) {
        await telegram.setMyCommands([...TELEGRAM_BOT_COMMANDS_FOR_ADMINS], { scope: privateChatScope });
      } else {
        await telegram.deleteMyCommands({ scope: privateChatScope }).catch(() => undefined);
      }
    }
  };

  /**
   * Создаёт бота, команды / меню, обработчики
   */
  public init = async (): Promise<void> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.loggerService.warn(this.tag, 'TELEGRAM_BOT_TOKEN не задан, бот не инициализирован');
      return;
    }

    this.bot = new Telegraf(token, getTelegrafProxyOptions());
    this.weddingBotCommands.registerBot(this.bot);

    await this.syncMyCommandsWithDatabase();

    this.loggerService.info(this.tag, 'Telegram-бот: обработчики и меню зарегистрированы');
  };

  public getBot = (): Telegraf<Context> => {
    if (!this.bot) {
      throw new Error('Telegram-бот не инициализирован, вызовите init() при заданном TELEGRAM_BOT_TOKEN');
    }
    return this.bot;
  };

  /**
   * Вход для POST /api/telegram/webhook (production)
   */
  public handleWebhook = async (request: Request, response: Response): Promise<void> => {
    try {
      const telegraf = this.getBot();
      await telegraf.handleUpdate(request.body);
      response.sendStatus(200);
    } catch (error) {
      this.loggerService.error(this.tag, error);
      response.sendStatus(500);
    }
  };

  /**
   * Development: long polling после deleteWebhook
   */
  public startLongPollingInDevelopment = async (): Promise<void> => {
    if (!this.bot) {
      return;
    }
    await this.bot.telegram.deleteWebhook();
    this.bot.launch().catch((error) => {
      this.loggerService.error(this.tag, 'Long polling: ошибка launch', error);
    });
    this.loggerService.info(this.tag, 'Telegram: long polling запущен (development)');
  };

  /**
   * Production: вебхук; TELEGRAM_WEBHOOK_URL — полный URL
   */
  public setProductionWebhook = async (webhookUrl: string): Promise<void> => {
    if (!this.bot) {
      return;
    }
    await this.bot.telegram.setWebhook(webhookUrl);
    this.loggerService.info(this.tag, `Telegram: установлен вебхук: ${webhookUrl}`);
  };

  public stopBot = (reason?: string): void => {
    this.bot?.stop(reason);
  };
}
