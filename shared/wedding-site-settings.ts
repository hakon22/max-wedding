/** Ключ строки в `wedding_site_setting` (сервер / миграции) */
export const WEDDING_SITE_SETTING_HEARTS_BACKGROUND = 'hearts_background' as const;

export type SiteDisplaySettingsDto = {
  heartsBackgroundEnabled: boolean;
};
