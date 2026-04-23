import 'reflect-metadata';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

import { DataSource } from 'typeorm';

import { entities } from '@server/db/entities';
import { TypeormLogger } from '@server/db/typeorm-logger';

const dir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const extension = isProduction ? 'js' : 'ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

/**
 * В контейнере `localhost` — сам контейнер, а не хост с Postgres.
 * `docker-compose.dev.yml` задаёт `host.docker.internal` через `extra_hosts`.
 */
const resolveDatabaseUrl = (raw: string): string => {
  if (process.env.IS_DOCKER !== 'TRUE') {
    return raw;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'host.docker.internal';
      return parsed.toString();
    }
  } catch {
    // нестандартный DSN — оставляем как есть
  }
  return raw;
};

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

/**
 * DataSource TypeORM: PostgreSQL, миграции и сущности
 */
export const appDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities,
  migrations: [path.join(dir, 'migrations', `*.${extension}`)],
  logging: !isProduction,
  logger: new TypeormLogger(),
  synchronize: false,
});
