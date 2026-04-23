import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import {
  Cormorant_Garamond,
  Comfortaa,
  EB_Garamond,
  Geist,
  Geist_Mono,
  Merriweather,
  Montserrat,
  Neucha,
  Nunito_Sans,
  Philosopher,
  Playfair_Display,
  Spectral,
} from 'next/font/google';

import '@/app/globals.css';
import { I18nProvider } from '@/components/i18n-provider';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/** Заголовки лендинга — по референсу wedwed: контрастный сериф + кириллица */
const weddingSerif = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-wedding-serif',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** Строка даты в герое: лёгкий гротеск с широким трекингом, как в моб. макете */
const heroDateSans = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-hero-date',
  weight: ['300', '400'],
  display: 'swap',
});

/** Временные варианты шрифта заголовков — панель превью для заказчика */
const weddingPreviewPlayfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-wedding-choice-playfair',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const weddingPreviewEbGaramond = EB_Garamond({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-wedding-choice-eb-garamond',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const weddingPreviewSpectral = Spectral({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-wedding-choice-spectral',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const weddingPreviewPhilosopher = Philosopher({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-wedding-choice-philosopher',
  weight: ['400', '700'],
  display: 'swap',
});

/** Временные варианты основного текста — панель превью */
const bodyPreviewMerriweather = Merriweather({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body-choice-merriweather',
  weight: ['300', '400', '700', '900'],
  display: 'swap',
});
const bodyPreviewNunitoSans = Nunito_Sans({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body-choice-nunito-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
const bodyPreviewComfortaa = Comfortaa({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body-choice-comfortaa',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
const bodyPreviewNeucha = Neucha({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body-choice-neucha',
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  title: 'Свадьба',
  description: 'Информация о мероприятии и ответы гостей',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

/**
 * Корневой layout App Router: шрифты, Ant Design registry
 */
const RootLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <html
      lang="ru"
      className={`${geist.variable} ${geistMono.variable} ${weddingSerif.variable} ${heroDateSans.variable} ${weddingPreviewPlayfair.variable} ${weddingPreviewEbGaramond.variable} ${weddingPreviewSpectral.variable} ${weddingPreviewPhilosopher.variable} ${bodyPreviewMerriweather.variable} ${bodyPreviewNunitoSans.variable} ${bodyPreviewComfortaa.variable} ${bodyPreviewNeucha.variable}`}
    >
      <body>
        <AntdRegistry>
          <ConfigProvider locale={ruRU}>
            <I18nProvider>{children}</I18nProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
};

export default RootLayout;
