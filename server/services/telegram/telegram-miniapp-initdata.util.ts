import { createHmac, timingSafeEqual } from 'crypto';

export type TelegramMiniAppUserPayload = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export class TelegramMiniAppInitDataValidationError extends Error {}

const buildDataCheckString = (params: URLSearchParams): string => {
  const pairs: string[] = [];
  const keys = Array.from(new Set(params.keys()))
    .filter((key) => key !== 'hash')
    .sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    const value = params.get(key);
    if (value === null) {
      continue;
    }
    pairs.push(`${key}=${value}`);
  }
  return pairs.join('\n');
};

const validateHash = (params: URLSearchParams, botToken: string): void => {
  const hash = params.get('hash');
  if (!hash) {
    throw new TelegramMiniAppInitDataValidationError('Missing Telegram hash');
  }
  const dataCheckString = buildDataCheckString(params);
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new TelegramMiniAppInitDataValidationError('Telegram initData signature is invalid');
  }
};

const parseUser = (params: URLSearchParams): TelegramMiniAppUserPayload => {
  const rawUser = params.get('user');
  if (!rawUser) {
    throw new TelegramMiniAppInitDataValidationError('Missing Telegram user in initData');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    throw new TelegramMiniAppInitDataValidationError('Invalid Telegram user payload');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new TelegramMiniAppInitDataValidationError('Invalid Telegram user payload');
  }
  const maybeUser = parsed as TelegramMiniAppUserPayload;
  if (!Number.isInteger(maybeUser.id) || maybeUser.id <= 0) {
    throw new TelegramMiniAppInitDataValidationError('Invalid Telegram user id');
  }
  return maybeUser;
};

const validateAuthAge = (params: URLSearchParams, maxAgeSec: number, nowMs: number): void => {
  const authDateRaw = params.get('auth_date');
  const authDateSec = Number(authDateRaw);
  if (!Number.isInteger(authDateSec) || authDateSec <= 0) {
    throw new TelegramMiniAppInitDataValidationError('Invalid auth_date in initData');
  }
  const nowSec = Math.floor(nowMs / 1000);
  if (authDateSec > nowSec + 30) {
    throw new TelegramMiniAppInitDataValidationError('Telegram auth_date is in the future');
  }
  if (nowSec - authDateSec > maxAgeSec) {
    throw new TelegramMiniAppInitDataValidationError('Telegram initData is expired');
  }
};

export const validateTelegramMiniAppInitData = (input: {
  initDataRaw: string;
  botToken: string;
  maxAgeSec: number;
  nowMs?: number;
}): TelegramMiniAppUserPayload => {
  const initDataRaw = input.initDataRaw?.trim();
  if (!initDataRaw) {
    throw new TelegramMiniAppInitDataValidationError('initData is required');
  }
  if (!input.botToken?.trim()) {
    throw new TelegramMiniAppInitDataValidationError('Telegram bot token is not configured');
  }
  const params = new URLSearchParams(initDataRaw);
  validateHash(params, input.botToken);
  validateAuthAge(params, input.maxAgeSec, input.nowMs ?? Date.now());
  return parseUser(params);
};
