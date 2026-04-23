import ExcelJS from 'exceljs';
import { Singleton } from 'typescript-ioc';

import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { BaseService } from '@server/services/app/base-service';
import { DRINK_LABELS, MAIN_COURSE_LABELS } from '@shared/guest-menu-codes';

/** Строка сырого результата для листа «Напитки» */
type GuestSubmissionDrinkExportRow = {
  guestSubmissionDrinkRowId: number;
  guestSubmissionId: number;
  drinkCode: string;
  guestName: string | null;
};

/**
 * Экспорт заявок в Excel (буфер для отправки в Telegram)
 */
@Singleton
export class GuestSubmissionExcelService extends BaseService {
  /**
   * Сборка книги: лист «Заявки» (плоско) и «Напитки» (нормализованно)
   */
  public buildSubmissionsWorkbookBuffer = async (): Promise<Buffer> => {
    const dataSource = this.databaseService.getDataSource();
    const guestSubmissionRepository = dataSource.getRepository(GuestSubmissionEntity);

    const guestSubmissions = await guestSubmissionRepository.find({
      relations: ['drinks'],
      order: { id: 'ASC' },
    });

    const entityManager = dataSource.manager;
    const guestSubmissionDrinkExportQueryBuilder = entityManager
      .createQueryBuilder(GuestSubmissionDrinkEntity, 'guestSubmissionDrink')
      .select([
        'guestSubmissionDrink.id AS "guestSubmissionDrinkRowId"',
        'guestSubmissionDrink.drinkCode AS "drinkCode"',
      ])
      .leftJoin('guestSubmissionDrink.submission', 'guestSubmission')
      .addSelect([
        'guestSubmission.id AS "guestSubmissionId"',
        'guestSubmission.guestName AS "guestName"',
      ])
      .orderBy('guestSubmission.id', 'ASC')
      .addOrderBy('guestSubmissionDrink.id', 'ASC');

    const guestSubmissionDrinkExportRows =
      await guestSubmissionDrinkExportQueryBuilder.getRawMany<GuestSubmissionDrinkExportRow>();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'max-wedding';
    const guestSubmissionsSheet = workbook.addWorksheet('Заявки', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    guestSubmissionsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Создано', key: 'created', width: 22 },
      { header: 'Имя', key: 'guestName', width: 28 },
      { header: 'Присутствие', key: 'plansToAttend', width: 14 },
      { header: 'Блюдо', key: 'mainCourse', width: 36 },
      { header: 'Напитки', key: 'drinks', width: 48 },
      { header: 'Дети', key: 'withChildren', width: 10 },
      { header: 'Ночлёг', key: 'needsOvernightStay', width: 12 },
      { header: 'Комментарий', key: 'message', width: 40 },
      { header: 'Источник', key: 'source', width: 12 },
    ];
    for (const guestSubmission of guestSubmissions) {
      const drinkLabelsForGuest =
        guestSubmission.drinks?.map(
          (guestSubmissionDrink) =>
            DRINK_LABELS[guestSubmissionDrink.drinkCode as keyof typeof DRINK_LABELS] ??
            guestSubmissionDrink.drinkCode,
        ) ?? [];
      guestSubmissionsSheet.addRow({
        id: guestSubmission.id,
        created: guestSubmission.created.toISOString(),
        guestName: guestSubmission.guestName ?? '',
        plansToAttend: guestSubmission.plansToAttend ? 'да' : 'нет',
        mainCourse: guestSubmission.mainCourseCode
          ? MAIN_COURSE_LABELS[guestSubmission.mainCourseCode as keyof typeof MAIN_COURSE_LABELS] ??
            guestSubmission.mainCourseCode
          : '—',
        drinks: drinkLabelsForGuest.join(', '),
        withChildren: guestSubmission.withChildren ? 'да' : 'нет',
        needsOvernightStay: guestSubmission.needsOvernightStay ? 'да' : 'нет',
        message: guestSubmission.message ?? '',
        source: guestSubmission.source,
      });
    }
    const guestSubmissionsHeaderRow = guestSubmissionsSheet.getRow(1);
    guestSubmissionsHeaderRow.font = { bold: true };

    const guestSubmissionDrinksSheet = workbook.addWorksheet('Напитки');
    guestSubmissionDrinksSheet.columns = [
      { header: 'ID строки', key: 'rowId', width: 12 },
      { header: 'ID заявки', key: 'submissionId', width: 12 },
      { header: 'Код напитка', key: 'drinkCode', width: 18 },
      { header: 'Напиток', key: 'drinkLabel', width: 22 },
      { header: 'Гость', key: 'guestName', width: 28 },
    ];
    for (const guestSubmissionDrinkExportRow of guestSubmissionDrinkExportRows) {
      guestSubmissionDrinksSheet.addRow({
        rowId: guestSubmissionDrinkExportRow.guestSubmissionDrinkRowId,
        submissionId: guestSubmissionDrinkExportRow.guestSubmissionId,
        drinkCode: guestSubmissionDrinkExportRow.drinkCode,
        drinkLabel:
          DRINK_LABELS[guestSubmissionDrinkExportRow.drinkCode as keyof typeof DRINK_LABELS] ??
          guestSubmissionDrinkExportRow.drinkCode,
        guestName: guestSubmissionDrinkExportRow.guestName ?? '',
      });
    }
    const guestSubmissionDrinksHeaderRow = guestSubmissionDrinksSheet.getRow(1);
    guestSubmissionDrinksHeaderRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  };
}
