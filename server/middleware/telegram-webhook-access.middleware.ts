import type { NextFunction, Request, Response } from 'express';

import { CheckIpService } from '@server/services/app/check-ip.service';

const checkIpService = new CheckIpService();

const telegramWebhookSubnets = [
  '91.108.4.0/22',
  '91.105.192.0/23',
  '91.108.8.0/22',
  '91.108.12.0/22',
  '91.108.16.0/22',
  '91.108.20.0/22',
  '91.108.56.0/23',
  '91.108.58.0/23',
  '95.161.64.0/20',
  '149.154.160.0/20',
  '149.154.160.0/21',
  '149.154.168.0/22',
  '149.154.172.0/22',
  '185.76.151.0/24',
];

const getClientIp = (req: Request): string | undefined => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && !Array.isArray(forwarded)) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
};

/**
 * Разрешать POST вебхука только с IP подсетей Telegram
 */
export const telegramWebhookAccessMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = getClientIp(req);
  if (!clientIp) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const allowed = telegramWebhookSubnets.some((subnet) => checkIpService.isCorrectIP(clientIp, subnet));
  if (allowed) {
    next();
    return;
  }
  res.status(401).json({ message: 'Unauthorized' });
};
