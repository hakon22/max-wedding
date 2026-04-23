import { Telegraf } from 'telegraf';
import { Singleton } from 'typescript-ioc';

import type { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { UserEntity, UserRoleEnum } from '@server/db/entities/user.entity';
import { BaseService } from '@server/services/app/base-service';
import { getTelegrafProxyOptions } from '@server/telegram/telegram-proxy.util';
import { DRINK_LABELS, MAIN_COURSE_LABELS } from '@shared/guest-menu-codes';

const TELEGRAM_MAX_MESSAGE = 3500;

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const yesNo = (value: boolean): string => (value ? 'да ✅' : 'нет ❌');

/** Визуальный разделитель между блоками (HTML) */
const blockSep = '\n\n';

const formatAdminNewSubmissionHtml = (submission: GuestSubmissionEntity): string => {
  const drinkLines =
    submission.drinks?.map(
      (guestSubmissionDrink) =>
        DRINK_LABELS[guestSubmissionDrink.drinkCode as keyof typeof DRINK_LABELS] ??
        guestSubmissionDrink.drinkCode,
    ) ?? [];
  const attending = submission.plansToAttend;
  const courseLabel = submission.mainCourseCode
    ? MAIN_COURSE_LABELS[submission.mainCourseCode as keyof typeof MAIN_COURSE_LABELS] ??
      submission.mainCourseCode
    : '—';
  const guest = escapeHtml(submission.guestName ?? '—');
  const header = '📋 <b>Новая заявка с сайта</b>';

  const identity =
    `<b>№ заявки</b> <code>#${submission.id}</code>` +
    blockSep +
    `<b>Имя гостя</b>\n${guest}` +
    blockSep +
    `<b>Планирует присутствовать</b>\n${yesNo(attending)}`;

  const menu =
    attending &&
    [
      '<b>Блюдо</b>',
      escapeHtml(courseLabel),
      '',
      '<b>Напитки</b>',
      escapeHtml(drinkLines.join(', ') || '—'),
      '',
      `<b>С детьми</b> ${yesNo(submission.withChildren)}`,
      `<b>Ночлёг после мероприятия</b> ${yesNo(submission.needsOvernightStay)}`,
    ].join('\n');

  const comment =
    '<b>Комментарий</b>\n' + (submission.message?.trim() ? escapeHtml(submission.message) : '<i>—</i>');

  return [header, identity, menu ? `${blockSep}${menu}` : '', comment].filter(Boolean).join(blockSep);
};

/**
 * Уведомление всех активных админов из таблицы user о новой заявке
 */
@Singleton
export class AdminSubmissionNotifyService extends BaseService {
  private readonly tag = 'AdminSubmissionNotifyService';

  /**
   * Рассылка краткой сводки по заявке; ошибки только в лог, без throw
   */
  public notifyAdminsOfNewSubmission = async (submission: GuestSubmissionEntity): Promise<void> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return;
    }
    const admins = await this.databaseService
      .getDataSource()
      .getRepository(UserEntity)
      .createQueryBuilder('userEntity')
      .where('userEntity.role = :role', { role: UserRoleEnum.ADMIN })
      .getMany();
    if (!admins.length) {
      this.loggerService.debug(this.tag, 'Нет активных админов в БД — уведомление пропущено');
      return;
    }
    let text = formatAdminNewSubmissionHtml(submission);
    if (text.length > TELEGRAM_MAX_MESSAGE) {
      text = `${text.slice(0, TELEGRAM_MAX_MESSAGE - 1)}…`;
    }
    const bot = new Telegraf(token, getTelegrafProxyOptions());
    for (const admin of admins) {
      try {
        await bot.telegram.sendMessage(admin.telegramId, text, { parse_mode: 'HTML' });
      } catch (error) {
        this.loggerService.error(this.tag, `Не удалось отправить админу ${admin.telegramId}`, error);
      }
    }
  };
}
