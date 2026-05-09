import type { ReactNode } from 'react';

import WeddingLanding from '@/app/wedding-landing.client';
import { loadMenuCatalogServer } from '@/lib/menu-catalog.server';
import { loadSiteDisplaySettingsServer } from '@/lib/site-display-settings.server';

export const dynamic = 'force-dynamic';

/**
 * Главная страница: лендинг свадьбы
 */
const Page = async (): Promise<ReactNode> => {
  const [menuCatalog, siteDisplaySettings] = await Promise.all([
    loadMenuCatalogServer(),
    loadSiteDisplaySettingsServer(),
  ]);
  return <WeddingLanding menuCatalog={menuCatalog} siteDisplaySettings={siteDisplaySettings} />;
};

export default Page;
