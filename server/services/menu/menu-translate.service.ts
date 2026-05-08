import { translate } from '@vitalets/google-translate-api';
import { Singleton } from 'typescript-ioc';

import { BaseService } from '@server/services/app/base-service';

@Singleton
export class MenuTranslateService extends BaseService {
  private readonly tag = 'MenuTranslateService';

  public translateRuToEn = async (labelRu: string): Promise<string> => {
    const normalized = labelRu.trim();
    if (!normalized) {
      return normalized;
    }
    try {
      const result = await translate(normalized, {
        from: 'ru',
        to: 'en',
      });
      const translated = result.text.trim();
      return translated.length ? translated : normalized;
    } catch (error) {
      this.loggerService.warn(this.tag, 'translate ru->en failed, fallback to ru text', error);
      return normalized;
    }
  };
}
