import * as yup from 'yup';
import type { Request, Response, Router } from 'express';
import { Container, Singleton } from 'typescript-ioc';

import {
  telegramMiniAppAdminAuthMiddleware,
  type TelegramMiniAppAuthenticatedRequest,
} from '@server/middleware/telegram-miniapp-admin-auth.middleware';
import { BaseRouter } from '@server/routes/base.route';
import { LoggerService } from '@server/services/app/logger-service';
import { MenuCatalogService, MenuCatalogValidationError } from '@server/services/menu/menu-catalog.service';
import {
  TelegramMiniAppAuthError,
  TelegramMiniAppAuthService,
} from '@server/services/telegram/telegram-miniapp-auth.service';
import type { MenuItemKind } from '@shared/menu-catalog';

const menuKindSchema = yup
  .mixed<MenuItemKind>()
  .oneOf(['mainCourse', 'drink'])
  .required();

const createMenuItemSchema = yup.object({
  kind: menuKindSchema,
  labelRu: yup.string().trim().required(),
  order: yup.number().integer().min(0).required(),
});

const updateMenuItemSchema = yup
  .object({
    kind: menuKindSchema,
    labelRu: yup.string().trim().optional(),
    order: yup.number().integer().min(0).optional(),
    isActive: yup.boolean().optional(),
  })
  .test('has-updates', 'Нужно передать хотя бы одно поле для обновления', (value) => {
    if (!value) {
      return false;
    }
    return value.labelRu !== undefined || value.order !== undefined || value.isActive !== undefined;
  });

const reorderSchema = yup.object({
  kind: menuKindSchema,
  orderedIds: yup
    .array()
    .of(yup.number().integer().positive().required())
    .min(1)
    .required(),
});

@Singleton
export class ApiTelegramMiniAppRoute extends BaseRouter {
  private readonly miniAppAuthService = Container.get(TelegramMiniAppAuthService);

  private readonly menuCatalogService = Container.get(MenuCatalogService);

  private readonly loggerService = Container.get(LoggerService);

  private parseId = (raw: string): number => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new MenuCatalogValidationError('Некорректный id');
    }
    return id;
  };

  public set = (router: Router): void => {
    router.post('/api/telegram-miniapp/auth', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const initData = await yup.string().trim().required().validate(req.body?.initData);
        const session = await this.miniAppAuthService.authenticateAdmin(initData);
        res.json({
          ok: true,
          token: session.token,
          expiresInSec: session.expiresInSec,
          user: {
            id: session.user.id,
            telegramId: session.user.telegramId,
            username: session.user.username,
            displayName: session.user.displayName,
          },
        });
      };
      run().catch((error) => {
        if (error instanceof TelegramMiniAppAuthError) {
          res.status(error.statusCode).json({ ok: false, error: error.message });
          return;
        }
        if (error instanceof yup.ValidationError) {
          res.status(400).json({ ok: false, error: error.errors.join(' ') });
          return;
        }
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-auth', normalizedError);
        res.status(500).json({ ok: false, error: 'Mini App auth failed' });
      });
    });

    router.use('/api/telegram-miniapp/menu', telegramMiniAppAdminAuthMiddleware);

    router.get('/api/telegram-miniapp/menu', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const catalog = await this.menuCatalogService.listCatalog(false);
        res.json({ ok: true, ...catalog });
      };
      run().catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-menu-list', normalizedError);
        res.status(500).json({ ok: false, error: 'Не удалось получить меню' });
      });
    });

    router.post('/api/telegram-miniapp/menu/items', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const payload = await createMenuItemSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
        const item = await this.menuCatalogService.createMenuItem(payload.kind, {
          labelRu: payload.labelRu,
          order: payload.order,
          isActive: true,
        });
        const user = (req as TelegramMiniAppAuthenticatedRequest).miniAppAdminUser;
        this.loggerService.info('telegram-miniapp-menu-create', {
          adminUserId: user.id,
          kind: payload.kind,
          itemId: item.id,
        });
        res.status(201).json({ ok: true, item });
      };
      run().catch((error) => {
        if (error instanceof MenuCatalogValidationError || error instanceof yup.ValidationError) {
          res.status(400).json({ ok: false, error: error.message });
          return;
        }
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-menu-create', normalizedError);
        res.status(500).json({ ok: false, error: 'Не удалось создать позицию меню' });
      });
    });

    router.patch('/api/telegram-miniapp/menu/items/:id', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const id = this.parseId(req.params.id);
        const payload = await updateMenuItemSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
        const item = await this.menuCatalogService.updateMenuItem(payload.kind, id, {
          labelRu: payload.labelRu,
          order: payload.order,
          isActive: payload.isActive,
        });
        const user = (req as TelegramMiniAppAuthenticatedRequest).miniAppAdminUser;
        this.loggerService.info('telegram-miniapp-menu-update', {
          adminUserId: user.id,
          kind: payload.kind,
          itemId: id,
        });
        res.json({ ok: true, item });
      };
      run().catch((error) => {
        if (error instanceof MenuCatalogValidationError || error instanceof yup.ValidationError) {
          res.status(400).json({ ok: false, error: error.message });
          return;
        }
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-menu-update', normalizedError);
        res.status(500).json({ ok: false, error: 'Не удалось обновить позицию меню' });
      });
    });

    router.delete('/api/telegram-miniapp/menu/items/:id', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const id = this.parseId(req.params.id);
        const kind = await menuKindSchema.validate(req.query.kind);
        await this.menuCatalogService.deleteMenuItem(kind, id);
        const user = (req as TelegramMiniAppAuthenticatedRequest).miniAppAdminUser;
        this.loggerService.info('telegram-miniapp-menu-delete', {
          adminUserId: user.id,
          kind,
          itemId: id,
        });
        res.json({ ok: true });
      };
      run().catch((error) => {
        if (error instanceof MenuCatalogValidationError || error instanceof yup.ValidationError) {
          res.status(400).json({ ok: false, error: error.message });
          return;
        }
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-menu-delete', normalizedError);
        res.status(500).json({ ok: false, error: 'Не удалось удалить позицию меню' });
      });
    });

    router.post('/api/telegram-miniapp/menu/reorder', (req: Request, res: Response) => {
      const run = async (): Promise<void> => {
        const payload = await reorderSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
        const items = await this.menuCatalogService.reorderMenuItems(payload.kind, payload.orderedIds);
        const user = (req as TelegramMiniAppAuthenticatedRequest).miniAppAdminUser;
        this.loggerService.info('telegram-miniapp-menu-reorder', {
          adminUserId: user.id,
          kind: payload.kind,
          size: payload.orderedIds.length,
        });
        res.json({ ok: true, items });
      };
      run().catch((error) => {
        if (error instanceof MenuCatalogValidationError || error instanceof yup.ValidationError) {
          res.status(400).json({ ok: false, error: error.message });
          return;
        }
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.loggerService.error('telegram-miniapp-menu-reorder', normalizedError);
        res.status(500).json({ ok: false, error: 'Не удалось изменить порядок позиций меню' });
      });
    });
  };
}
