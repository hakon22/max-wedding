import 'server-only';

import type { MenuCatalogDto } from '@shared/menu-catalog';

type MenuCatalogApiResponse = { ok: true } & MenuCatalogDto;

const resolveBaseUrls = (): string[] => {
  const urls: string[] = [];
  const internal = process.env.APP_INTERNAL_URL?.replace(/\/$/, '');
  if (internal) {
    urls.push(internal);
  }
  const port = process.env.PORT ?? '3015';
  urls.push(`http://localhost:${port}`);
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (publicUrl && !urls.includes(publicUrl)) {
    urls.push(publicUrl);
  }
  return urls;
};

export const loadMenuCatalogServer = async (): Promise<MenuCatalogDto> => {
  const errors: string[] = [];
  for (const baseUrl of resolveBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}/api/menu-options?activeOnly=true`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        errors.push(`${baseUrl} -> ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as MenuCatalogApiResponse;
      return {
        mainCourses: payload.mainCourses ?? [],
        drinks: payload.drinks ?? [],
      };
    } catch (error) {
      errors.push(`${baseUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Failed to load menu catalog. Attempts: ${errors.join('; ')}`);
};
