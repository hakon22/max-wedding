import * as yup from 'yup';
import type { Request, Response, Router } from 'express';
import { Container, Singleton } from 'typescript-ioc';

import { DatabaseService } from '@server/db/database-service';
import { BaseRouter } from '@server/routes/base.route';
import { AdminSubmissionNotifyService } from '@server/services/guest/admin-submission-notify.service';
import { GuestSubmissionService } from '@server/services/guest/guest-submission.service';
import { LoggerService } from '@server/services/app/logger-service';
import { DeveloperNotifyService } from '@server/telegram/developer-notify.service';
import { guestSubmissionRequestSchema } from '@shared/guest-submission.schema';

@Singleton
export class ApiSubmissionRoute extends BaseRouter {
  private readonly databaseService = Container.get(DatabaseService);

  private readonly guestSubmissionService = Container.get(GuestSubmissionService);

  private readonly adminSubmissionNotifyService = Container.get(AdminSubmissionNotifyService);

  private readonly developerNotifyService = Container.get(DeveloperNotifyService);

  private readonly loggerService = Container.get(LoggerService);

  public set = (router: Router): void => {
    /**
     * Создание заявки: POST /api/submissions
     */
    router.post('/api/submissions', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        let body: yup.InferType<typeof guestSubmissionRequestSchema>;
        try {
          body = await guestSubmissionRequestSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
          });
        } catch (error) {
          if (error instanceof yup.ValidationError) {
            res.status(400).json({ ok: false, error: error.errors.join(' ') });
            return;
          }
          throw error;
        }

        if (!this.databaseService.getDataSource().isInitialized) {
          res.status(503).json({ ok: false, error: 'База данных не готова' });
          return;
        }

        const guestSubmissionRecord = await this.guestSubmissionService.createFromValidatedBody(body);
        void this.adminSubmissionNotifyService.notifyAdminsOfNewSubmission(guestSubmissionRecord);
        res.status(201).json({ ok: true, id: guestSubmissionRecord.id });
      };

      run().catch(async (error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('submission', normalizedError);
        if (!res.headersSent) {
          await this.developerNotifyService.notifyDeveloperError(normalizedError, 'POST /api/submissions');
          res.status(500).json({ ok: false, error: 'Не удалось сохранить заявку' });
        }
      });
    });

    /**
     * Health check API
     */
    router.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        ok: true,
        db: this.databaseService.getDataSource().isInitialized,
        when: new Date().toISOString(),
      });
    });
  };
}
