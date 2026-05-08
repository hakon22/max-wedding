import type { NextFunction, Request, Response } from 'express';
import { Container } from 'typescript-ioc';

import type { UserEntity } from '@server/db/entities/user.entity';
import { TelegramMiniAppAuthService } from '@server/services/telegram/telegram-miniapp-auth.service';

export type TelegramMiniAppAuthenticatedRequest = Request & {
  miniAppAdminUser: UserEntity;
};

const authService = Container.get(TelegramMiniAppAuthService);

export const telegramMiniAppAdminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.header('authorization') ?? '';
    if (!header.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ ok: false, error: 'Bearer token is required' });
      return;
    }
    const token = header.slice(7).trim();
    if (!token) {
      res.status(401).json({ ok: false, error: 'Bearer token is required' });
      return;
    }
    const user = await authService.getAdminByToken(token);
    if (!user) {
      res.status(401).json({ ok: false, error: 'Unauthorized token' });
      return;
    }
    (req as TelegramMiniAppAuthenticatedRequest).miniAppAdminUser = user;
    next();
  } catch {
    res.status(500).json({ ok: false, error: 'Authorization failed' });
  }
};
