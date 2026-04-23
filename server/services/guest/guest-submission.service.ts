import { Singleton } from 'typescript-ioc';
import * as yup from 'yup';

import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { BaseService } from '@server/services/app/base-service';
import type { GuestPreferencesAbsent, GuestPreferencesAttending } from '@shared/guest-submission.schema';
import { guestSubmissionRequestSchema } from '@shared/guest-submission.schema';

@Singleton
export class GuestSubmissionService extends BaseService {
  /**
   * Сохранение валидированного тела заявки (шапка + строки напитков в одной транзакции)
   */
  public createFromValidatedBody = async (
    body: yup.InferType<typeof guestSubmissionRequestSchema>,
  ): Promise<GuestSubmissionEntity> => {
    const dataSource = this.databaseService.getDataSource();
    const savedGuestSubmission = await dataSource.transaction(async (entityManager) => {
      const guestSubmissionRecord = new GuestSubmissionEntity();
      guestSubmissionRecord.guestName = body.guestName ?? null;
      guestSubmissionRecord.plansToAttend = body.plansToAttend;
      if (body.plansToAttend) {
        const preferences = body.preferences as GuestPreferencesAttending;
        guestSubmissionRecord.withChildren = preferences.withChildren;
        guestSubmissionRecord.needsOvernightStay = preferences.needsOvernightStay;
        const trimmedAttendingMessage = preferences.message?.trim();
        guestSubmissionRecord.message =
          trimmedAttendingMessage && trimmedAttendingMessage.length > 0 ? trimmedAttendingMessage : null;
        guestSubmissionRecord.mainCourseCode = preferences.mainCourseCode;
        guestSubmissionRecord.drinks = preferences.drinkCodes.map((drinkCode) => {
          const guestSubmissionDrinkRow = new GuestSubmissionDrinkEntity();
          guestSubmissionDrinkRow.drinkCode = drinkCode;
          return guestSubmissionDrinkRow;
        });
      } else {
        guestSubmissionRecord.withChildren = false;
        guestSubmissionRecord.needsOvernightStay = false;
        const absentPreferences = body.preferences as GuestPreferencesAbsent;
        const trimmedMessage = absentPreferences.message?.trim();
        guestSubmissionRecord.message = trimmedMessage && trimmedMessage.length > 0 ? trimmedMessage : null;
        guestSubmissionRecord.mainCourseCode = null;
        guestSubmissionRecord.drinks = [];
      }
      guestSubmissionRecord.source = 'web';
      return entityManager.save(guestSubmissionRecord);
    });
    const guestSubmissionWithDrinks = await dataSource.getRepository(GuestSubmissionEntity).findOne({
      where: { id: savedGuestSubmission.id },
      relations: ['drinks'],
    });
    this.loggerService.info('submission', { id: savedGuestSubmission.id });
    return guestSubmissionWithDrinks ?? savedGuestSubmission;
  };
}
