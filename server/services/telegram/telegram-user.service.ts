import type { Context } from 'telegraf';
import { Singleton } from 'typescript-ioc';

import { UserEntity, UserRoleEnum } from '@server/db/entities/user.entity';
import { BaseService } from '@server/services/app/base-service';

/**
 * Регистрация и обновление пользователей Telegram в БД
 */
@Singleton
export class TelegramUserService extends BaseService {
  /**
   * Upsert пользователя по данным из контекста Telegraf
   */
  public ensureUserFromContext = async (context: Context): Promise<UserEntity> => {
    const telegramId = context.from?.id?.toString();
    if (!telegramId) {
      throw new Error('В контексте нет telegram id');
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
    user.username = context.from?.username ?? user.username ?? null;
    user.firstName = context.from?.first_name ?? user.firstName ?? null;
    user.lastName = context.from?.last_name ?? user.lastName ?? null;
    user.displayName =
      [context.from?.first_name, context.from?.last_name].filter(Boolean).join(' ').trim() ||
      user.displayName ||
      null;
    user.lastSeenAt = new Date();
    return repo.save(user);
  };

  /** Активный администратор для доступа к командам бота */
  public isActiveAdmin = (user: UserEntity): boolean =>
    user.role === UserRoleEnum.ADMIN && !user.deleted;
}
