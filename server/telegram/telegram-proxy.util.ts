import { HttpsProxyAgent } from 'https-proxy-agent';
import { type Context, Telegraf } from 'telegraf';

const proxyAgent =
  process.env.PROXY_USER && process.env.PROXY_PASS && process.env.PROXY_HOST
    ? new HttpsProxyAgent(`http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}`)
    : null;

/**
 * Опции Telegraf с HTTP(S) прокси
 */
export const getTelegrafProxyOptions = (): Partial<Telegraf.Options<Context>> => {
  if (!proxyAgent) {
    return {};
  }
  return { telegram: { agent: proxyAgent } };
};
