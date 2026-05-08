import { randomBytes } from 'crypto';

import { Container, Singleton } from 'typescript-ioc';

import { UserEntity } from '@server/db/entities/user.entity';
import { BaseService } from '@server/services/app/base-service';
import {
  TelegramMiniAppInitDataValidationError,
  validateTelegramMiniAppInitData,
} from '@server/services/telegram/telegram-miniapp-initdata.util';
import { TelegramUserService } from '@server/services/telegram/telegram-user.service';

type TelegramMiniAppSession = {
  token: string;
  userId: number;
  expiresAtMs: number;
};

export class TelegramMiniAppAuthError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

@Singleton
export class TelegramMiniAppAuthService extends BaseService {
  private readonly telegramUserService = Container.get(TelegramUserService);

  private readonly sessionsByToken = new Map<string, TelegramMiniAppSession>();

  private readonly defaultMaxAgeSec = 30 * 60;

  private readonly sessionTtlSec = 30 * 60;

  private getInitDataMaxAgeSec = (): number => {
    const raw = process.env.TELEGRAM_MINIAPP_INITDATA_MAX_AGE_SECONDS;
    if (!raw) {
      return this.defaultMaxAgeSec;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : this.defaultMaxAgeSec;
  };

  private cleanupExpiredSessions = (): void => {
    const nowMs = Date.now();
    for (const [token, session] of this.sessionsByToken.entries()) {
      if (session.expiresAtMs <= nowMs) {
        this.sessionsByToken.delete(token);
      }
    }
  };

  public authenticateAdmin = async (
    initDataRaw: string,
  ): Promise<{ token: string; expiresInSec: number; user: UserEntity }> => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new TelegramMiniAppAuthError('Telegram bot token is not configured', 503);
    }
    let userPayload;
    try {
      userPayload = validateTelegramMiniAppInitData({
        initDataRaw,
        botToken,
        maxAgeSec: this.getInitDataMaxAgeSec(),
      });
    } catch (error) {
      if (error instanceof TelegramMiniAppInitDataValidationError) {
        throw new TelegramMiniAppAuthError(error.message);
      }
      throw error;
    }
    const user = await this.telegramUserService.ensureUserFromMiniApp(userPayload);
    if (!this.telegramUserService.isActiveAdmin(user)) {
      throw new TelegramMiniAppAuthError('Admin access required', 403);
    }
    this.cleanupExpiredSessions();
    const token = randomBytes(32).toString('base64url');
    this.sessionsByToken.set(token, {
      token,
      userId: user.id,
      expiresAtMs: Date.now() + this.sessionTtlSec * 1000,
    });
    return { token, expiresInSec: this.sessionTtlSec, user };
  };

  public getAdminByToken = async (token: string): Promise<UserEntity | null> => {
    this.cleanupExpiredSessions();
    const session = this.sessionsByToken.get(token);
    if (!session) {
      return null;
    }
    if (session.expiresAtMs <= Date.now()) {
      this.sessionsByToken.delete(token);
      return null;
    }
    const userRepo = this.databaseService.getDataSource().getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: session.userId }, withDeleted: true });
    if (!user || !this.telegramUserService.isActiveAdmin(user)) {
      this.sessionsByToken.delete(token);
      return null;
    }
    return user;
  };
}
