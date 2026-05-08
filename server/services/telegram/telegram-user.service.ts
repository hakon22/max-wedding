import type { Context } from 'telegraf';
import { Singleton } from 'typescript-ioc';

import { UserEntity, UserRoleEnum } from '@server/db/entities/user.entity';
import { BaseService } from '@server/services/app/base-service';

type TelegramProfileInput = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

/**
 * Регистрация и обновление пользователей Telegram в БД
 */
@Singleton
export class TelegramUserService extends BaseService {
  private upsertByTelegramProfile = async (profile: TelegramProfileInput): Promise<UserEntity> => {
    const telegramId = profile.id?.toString();
    if (!telegramId) {
      throw new Error('В профиле нет telegram id');
    }
    const repo = this.databaseService.getDataSource().getRepository(UserEntity);
    let user = await repo.findOne({ where: { telegramId }, withDeleted: true });
    if (!user) {
      user = new UserEntity();
      user.telegramId = telegramId;
      user.role = UserRoleEnum.USER;
    } else if (user.deleted) {
      user.deleted = null;
    }
    user.username = profile.username ?? user.username ?? null;
    user.firstName = profile.first_name ?? user.firstName ?? null;
    user.lastName = profile.last_name ?? user.lastName ?? null;
    user.displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
      user.displayName ||
      null;
    user.lastSeenAt = new Date();
    return repo.save(user);
  };

  /**
   * Upsert пользователя по данным из контекста Telegraf
   */
  public ensureUserFromContext = async (context: Context): Promise<UserEntity> => {
    if (!context.from?.id) {
      throw new Error('В контексте нет telegram id');
    }
    return this.upsertByTelegramProfile({
      id: context.from.id,
      username: context.from.username,
      first_name: context.from.first_name,
      last_name: context.from.last_name,
    });
  };

  public ensureUserFromMiniApp = async (profile: TelegramProfileInput): Promise<UserEntity> =>
    this.upsertByTelegramProfile(profile);

  /** Активный администратор для доступа к командам бота */
  public isActiveAdmin = (user: UserEntity): boolean =>
    user.role === UserRoleEnum.ADMIN && !user.deleted;
}
