'use client';

import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/locales';

type I18nProviderProps = {
  children: ReactNode;
};

/**
 * Провайдер i18next для клиентских компонентов
 */
export const I18nProvider = ({ children }: I18nProviderProps): ReactNode => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
