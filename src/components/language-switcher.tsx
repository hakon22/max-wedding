'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';

import { getWeddingLanguageStorageKey } from '@/locales';
import styles from '@/components/language-switcher.module.css';

type LanguageCode = 'ru' | 'en';

/**
 * Переключение ru/en: i18next + localStorage (тот же ключ, что при старте в `locales/index.ts`)
 */
export const LanguageSwitcher = (): ReactNode => {
  const { i18n, t } = useTranslation();
  const resolved: LanguageCode = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'ru';

  useEffect(() => {
    document.documentElement.lang = resolved === 'en' ? 'en' : 'ru';
  }, [resolved]);

  const persistLanguage = (code: LanguageCode): void => {
    try {
      localStorage.setItem(getWeddingLanguageStorageKey(), code);
    } catch {
      /* storage недоступен — только смена языка в памяти */
    }
  };

  const onChange = (value: string): void => {
    const code = value as LanguageCode;
    void i18n.changeLanguage(code);
    persistLanguage(code);
  };

  return (
    <div className={styles.wrap} role="navigation" aria-label={t('weddingLanding.ui.language')}>
      <Segmented<LanguageCode>
        size="small"
        value={resolved}
        onChange={onChange}
        options={[
          { label: 'RU', value: 'ru' },
          { label: 'EN', value: 'en' },
        ]}
      />
    </div>
  );
};
