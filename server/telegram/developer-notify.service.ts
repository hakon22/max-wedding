import { Telegraf } from 'telegraf';
import { Singleton } from 'typescript-ioc';

import { BaseService } from '@server/services/app/base-service';
import { getTelegrafProxyOptions } from '@server/telegram/telegram-proxy.util';

const TELEGRAM_MAX_MESSAGE = 3500;

const escapeHtml = (value: string): string => {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};

@Singleton
export class DeveloperNotifyService extends BaseService {
  /**
   * Уведомление разработчика в production
   */
  public notifyDeveloperError = async (error: Error, contextLabel?: string): Promise<void> => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (!error.stack) {
      return;
    }
    const chatId = process.env.TELEGRAM_DEVELOPER_CHAT_ID;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!chatId || !token) {
      return;
    }
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'max-wedding';
    const lines = [
      `Ошибка на сервере <b>${escapeHtml(appName)}</b>`,
      contextLabel ? `(${escapeHtml(contextLabel)})` : null,
      `<pre>${escapeHtml(error.stack.length > TELEGRAM_MAX_MESSAGE ? `${error.stack.slice(0, TELEGRAM_MAX_MESSAGE)}…` : error.stack)}</pre>`,
    ].filter((line): line is string => line !== null);
    const text = lines.join('\n');
    const bot = new Telegraf(token, getTelegrafProxyOptions());
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (sendError) {
      this.loggerService.error('notifyDeveloperError', sendError);
    }
  };
}
