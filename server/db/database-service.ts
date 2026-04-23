import { type DataSource } from 'typeorm';
import { Singleton } from 'typescript-ioc';

import { appDataSource } from '@server/db/data-source';

@Singleton
export abstract class DatabaseService {
  private readonly db: DataSource = appDataSource;

  public getDataSource = (): DataSource => {
    return this.db;
  };

  public getManager = () => {
    if (!this.db.isInitialized) {
      throw new Error('Database connection is not initialized. Please call init() first.');
    }
    return this.db.createEntityManager();
  };

  public init = async (): Promise<void> => {
    await this.db.initialize();
  };
}
