import type { ReactNode } from 'react';

import WeddingLanding from '@/app/wedding-landing.client';
import { loadMenuCatalogServer } from '@/lib/menu-catalog.server';

export const dynamic = 'force-dynamic';

/**
 * Главная страница: лендинг свадьбы
 */
const Page = async (): Promise<ReactNode> => {
  const menuCatalog = await loadMenuCatalogServer();
  return <WeddingLanding menuCatalog={menuCatalog} />;
};

export default Page;
