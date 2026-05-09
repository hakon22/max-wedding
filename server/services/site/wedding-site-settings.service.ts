import { Singleton } from 'typescript-ioc';

import { WeddingSiteSettingEntity } from '@server/db/entities/wedding-site-setting.entity';
import { BaseService } from '@server/services/app/base-service';
import { WEDDING_SITE_SETTING_HEARTS_BACKGROUND } from '@shared/wedding-site-settings';

@Singleton
export class WeddingSiteSettingsService extends BaseService {
  public getHeartsBackgroundEnabled = async (): Promise<boolean> => {
    if (!this.databaseService.getDataSource().isInitialized) {
      return true;
    }
    const row = await this.databaseService
      .getDataSource()
      .getRepository(WeddingSiteSettingEntity)
      .findOne({ where: { settingKey: WEDDING_SITE_SETTING_HEARTS_BACKGROUND } });
    const raw = row?.value;
    if (typeof raw === 'boolean') {
      return raw;
    }
    return true;
  };

  public setHeartsBackgroundEnabled = async (enabled: boolean): Promise<void> => {
    const repository = this.databaseService.getDataSource().getRepository(WeddingSiteSettingEntity);
    await repository.save({
      settingKey: WEDDING_SITE_SETTING_HEARTS_BACKGROUND,
      value: enabled,
    });
  };

  public toggleHeartsBackgroundEnabled = async (): Promise<boolean> => {
    const current = await this.getHeartsBackgroundEnabled();
    const next = !current;
    await this.setHeartsBackgroundEnabled(next);
    return next;
  };
}
