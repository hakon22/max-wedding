import { exec } from 'child_process';
import { promisify } from 'util';

class CreateMigrationHelper {
  private execAsync = promisify(exec);

  private readonly defaultMigrationPath = './server/db/migrations';

  /**
   * Создаёт файл миграции TypeORM с заданным именем
   * @param migrationName - имя файла миграции (без пути)
   * @returns Promise завершения команды
   */
  private createMigration = async (migrationName: string): Promise<void> => {
    const migrationFullPath = `${this.defaultMigrationPath}/${migrationName}`;

    try {
      const { stdout, stderr } = await this.execAsync(`npm run migration:create -- ${migrationFullPath}`);
      console.log(stdout);
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Failed to create migration:', error);
    }
  };

  public run = (): void => {
    const migrationName = process.argv[2];
    if (!migrationName) {
      console.error('Укажите имя миграции: npm run migration:create:name <Имя>');
      process.exit(1);
    }

    this.createMigration(migrationName).catch((error) => {
      console.error('Failed to create migration:', error);
    });
  };
}

const helper = new CreateMigrationHelper();

helper.run();
