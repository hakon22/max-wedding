import { createHmac } from 'crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TelegramMiniAppInitDataValidationError,
  validateTelegramMiniAppInitData,
} from '@server/services/telegram/telegram-miniapp-initdata.util';

const signInitData = (params: URLSearchParams, botToken: string): string => {
  const keys = Array.from(new Set(params.keys()))
    .filter((key) => key !== 'hash')
    .sort((left, right) => left.localeCompare(right));
  const dataCheckString = keys
    .map((key) => `${key}=${params.get(key) ?? ''}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
};

const buildSignedInitData = (options?: { authDateSec?: number; userId?: number }): { raw: string; token: string } => {
  const botToken = '123456:ABC_test_token';
  const params = new URLSearchParams();
  params.set(
    'user',
    JSON.stringify({
      id: options?.userId ?? 123456789,
      first_name: 'Max',
      last_name: 'Wedding',
      username: 'maxwedding',
    }),
  );
  params.set('auth_date', String(options?.authDateSec ?? Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAHgAAABY');
  return {
    raw: signInitData(params, botToken),
    token: botToken,
  };
};

test('validateTelegramMiniAppInitData: valid initData passes', () => {
  const { raw, token } = buildSignedInitData();
  const result = validateTelegramMiniAppInitData({
    initDataRaw: raw,
    botToken: token,
    maxAgeSec: 600,
  });
  assert.equal(result.id, 123456789);
  assert.equal(result.username, 'maxwedding');
});

test('validateTelegramMiniAppInitData: invalid hash throws', () => {
  const { raw, token } = buildSignedInitData();
  const tamperedParams = new URLSearchParams(raw);
  tamperedParams.set(
    'user',
    JSON.stringify({
      id: 123456789,
      first_name: 'Tampered',
      last_name: 'Wedding',
      username: 'maxwedding',
    }),
  );
  const tampered = tamperedParams.toString();
  assert.throws(
    () =>
      validateTelegramMiniAppInitData({
        initDataRaw: tampered,
        botToken: token,
        maxAgeSec: 600,
      }),
    TelegramMiniAppInitDataValidationError,
  );
});

test('validateTelegramMiniAppInitData: expired initData throws', () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const { raw, token } = buildSignedInitData({ authDateSec: nowSec - 700 });
  assert.throws(
    () =>
      validateTelegramMiniAppInitData({
        initDataRaw: raw,
        botToken: token,
        maxAgeSec: 600,
        nowMs: nowSec * 1000,
      }),
    TelegramMiniAppInitDataValidationError,
  );
});

test('validateTelegramMiniAppInitData: future auth_date throws', () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const { raw, token } = buildSignedInitData({ authDateSec: nowSec + 120 });
  assert.throws(
    () =>
      validateTelegramMiniAppInitData({
        initDataRaw: raw,
        botToken: token,
        maxAgeSec: 600,
        nowMs: nowSec * 1000,
      }),
    TelegramMiniAppInitDataValidationError,
  );
});
