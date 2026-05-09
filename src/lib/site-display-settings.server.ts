import 'server-only';

import type { SiteDisplaySettingsDto } from '@shared/wedding-site-settings';

type SiteDisplaySettingsResponse = { ok: true } & SiteDisplaySettingsDto;

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

export const loadSiteDisplaySettingsServer = async (): Promise<SiteDisplaySettingsDto> => {
  const errors: string[] = [];
  for (const baseUrl of resolveBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}/api/site-display-settings`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        errors.push(`${baseUrl} -> ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as SiteDisplaySettingsResponse;
      return {
        heartsBackgroundEnabled: payload.heartsBackgroundEnabled ?? true,
      };
    } catch (error) {
      errors.push(`${baseUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Failed to load site display settings. Attempts: ${errors.join('; ')}`);
};
