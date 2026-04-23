import { Container } from 'typescript-ioc';

import { DatabaseService } from '@server/db/database-service';
import { LoggerService } from '@server/services/app/logger-service';

/**
 * Доступ к БД и логгеру для сервисов, наследующих этот класс
 */
export abstract class BaseService {
  protected databaseService = Container.get(DatabaseService);

  protected loggerService = Container.get(LoggerService);
}
