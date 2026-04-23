/** Коды основного блюда из ТЗ (анкета гостя) */
export const MAIN_COURSE_CODES = ['beef_tenderloin_steak', 'lamb_rack', 'grilled_trout'] as const;

/** Коды напитков из ТЗ */
export const DRINK_CODES = [
  'sparkling_wine',
  'white_wine',
  'red_wine',
  'whiskey',
  'cognac',
  'rum',
  'gin',
  'no_alcohol',
] as const;

export type MainCourseCode = (typeof MAIN_COURSE_CODES)[number];

export type DrinkCode = (typeof DRINK_CODES)[number];

export const MAIN_COURSE_LABELS: Record<MainCourseCode, string> = {
  beef_tenderloin_steak: 'Стейк из говяжьей вырезки',
  lamb_rack: 'Каре молодого барашка',
  grilled_trout: 'Форель гриль',
};

export const DRINK_LABELS: Record<DrinkCode, string> = {
  sparkling_wine: 'Вино игристое',
  white_wine: 'Вино белое',
  red_wine: 'Вино красное',
  whiskey: 'Виски',
  cognac: 'Коньяк',
  rum: 'Ром',
  gin: 'Джин',
  no_alcohol: 'Не пью алкоголь',
};

export const isMainCourseCode = (v: string): v is MainCourseCode =>
  (MAIN_COURSE_CODES as readonly string[]).includes(v);

export const isDrinkCode = (value: string): value is DrinkCode => (DRINK_CODES as readonly string[]).includes(value);
