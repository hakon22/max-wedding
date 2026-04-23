import 'reflect-metadata';
import 'dotenv/config';

import type { Server as NodeHttpServer } from 'http';

import next from 'next';
import express from 'express';
import { Container } from 'typescript-ioc';

import { telegramWebhookAccessMiddleware } from '@server/middleware/telegram-webhook-access.middleware';
import { ApiSubmissionRoute } from '@server/routes/api-submission.route';
import { BaseService } from '@server/services/app/base-service';
import { LoggerService } from '@server/services/app/logger-service';
import { TelegramBotService } from '@server/telegram/telegram-bot.service';

const port = Number(process.env.PORT) || 3015;

/**
 * Сборка Express + Next и сервисов, по шагам как `Server` в am-chokers/server/server.ts
 */
class WeddingServer extends BaseService {
  private readonly apiSubmissionRoute = Container.get(ApiSubmissionRoute);

  private readonly telegramBotService = Container.get(TelegramBotService);

  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  private readonly nextApplication = next({
    dev: this.isDevelopment,
    /** тот же порт, что у Express: иначе в `.next/dev/lock` и в ошибках фигурирует 3000 */
    port,
    hostname: 'localhost',
  });

  private readonly nextRequestHandler = this.nextApplication.getRequestHandler();

  private expressApplication = express();

  private httpListener: NodeHttpServer | null = null;

  private isShuttingDown = false;

  /**
   * База, Next prepare
   */
  private initializeStorageAndApp = async (): Promise<void> => {
    await this.databaseService.init();
    await this.nextApplication.prepare();
  };

  /**
   * JSON, опционально Telegram-вебхук, API заявок, catch-all в Next
   */
  private configureHttpApplication = (): void => {
    this.expressApplication.use(express.json());

    const hasTelegramToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    if (hasTelegramToken) {
      this.expressApplication.post(
        '/api/telegram/webhook',
        telegramWebhookAccessMiddleware,
        (request, response) => {
          this.telegramBotService.handleWebhook(request, response).catch((error) => {
            this.loggerService.error('Telegram webhook', error);
          });
        },
      );
    }

    const submissionApiRouter = express.Router();
    this.apiSubmissionRoute.set(submissionApiRouter);
    this.expressApplication.use(submissionApiRouter);
    this.expressApplication.all('*', (request, response) => {
      return this.nextRequestHandler(request, response);
    });
  };

  /**
   * Init бота, long polling (dev) или setWebhook (prod) — до listen, как assistent-bot
   */
  private connectTelegram = async (): Promise<void> => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return;
    }
    await this.telegramBotService.init();

    if (this.isDevelopment) {
      await this.telegramBotService.startLongPollingInDevelopment();
      return;
    }
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('TELEGRAM_WEBHOOK_URL is not set for production Telegram webhook mode');
    }
    await this.telegramBotService.setProductionWebhook(webhookUrl);
  };

  private listen = (): void => {
    this.httpListener = this.expressApplication.listen(port, () => {
      this.loggerService.info('WeddingServer', `HTTP: http://localhost:${port}`);
    });

    const closeHttpAndNext = (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }
      this.isShuttingDown = true;

      /** В dev Next.close() и long polling часто дольше 10 с — иначе ложный warn «Shutdown timeout». */
      const shutdownGraceMs = this.isDevelopment ? 35_000 : 12_000;

      const forceExitTimer = setTimeout(() => {
        this.loggerService.warn('WeddingServer', 'Shutdown timeout, exiting');
        process.exit(0);
      }, shutdownGraceMs);

      (async () => {
        try {
          try {
            this.telegramBotService.stopBot(signal);
          } catch (error) {
            this.loggerService.debug('WeddingServer', 'Telegram stop (игнорируем)', error);
          }

          if (this.isDevelopment) {
            try {
              await this.nextApplication.close();
            } catch (error) {
              this.loggerService.error('WeddingServer: Next close on shutdown', error);
            }
          }

          const httpServer = this.httpListener as NodeHttpServer & { closeAllConnections?: () => void };
          httpServer.closeAllConnections?.();

          await new Promise<void>((resolve) => {
            if (!this.httpListener) {
              resolve();
              return;
            }
            this.httpListener.close(() => resolve());
          });

          const dataSource = this.databaseService.getDataSource();
          if (dataSource.isInitialized) {
            await dataSource.destroy().catch((error) => {
              this.loggerService.debug('WeddingServer', 'DB destroy on shutdown', error);
            });
          }
        } finally {
          clearTimeout(forceExitTimer);
        }
        process.exit(0);
      })();
    };

    process.once('SIGINT', () => {
      closeHttpAndNext('SIGINT');
    });
    process.once('SIGTERM', () => {
      closeHttpAndNext('SIGTERM');
    });
  };

  public start = async (): Promise<void> => {
    await this.initializeStorageAndApp();
    this.configureHttpApplication();
    await this.connectTelegram();
    this.listen();
  };
}

new WeddingServer()
  .start()
  .catch((error) => {
    Container.get(LoggerService).error('Fatal', error);
    process.exit(1);
  });
