/**
 * Технические константы лендинга (пути к медиа, дата для календаря, ссылки).
 * Тексты интерфейса — в src/locales (i18n).
 */
export const weddingSiteConfig = {
  weddingYear: 2026,
  weddingMonthIndex: 7,
  weddingDay: 23,
  heroImageSrc: '/wedding/hero.jpeg',
  /**
   * Только при object-fit: cover (ширина до 899px): сдвиг кропа, если пара уезжает влево.
   * На десктопе герой использует contain — фото целиком, позиция center.
   */
  heroImageObjectPosition: '56% center' as const,
  videoSrc: '/wedding/video.mp4',
  videoMimeType: 'video/mp4',
  videoPosterSrc: '/wedding/video-poster.jpg',
  /** Ссылка на карточку организации (сайт, шаринг) */
  mapsUrl:
    'https://yandex.ru/maps/org/bereg_zhelaniy/64977620779?si=t24hjtzzzqwz493a5v7ybnhufg',
  /**
   * Виджет Яндекс.Карт (iframe). Центр и z соответствуют карточке «Берег желаний».
   * @see https://yandex.com/support/maps/ru/get-map-reference
   */
  yandexMapEmbedUrl:
    'https://yandex.ru/map-widget/v1/?ll=36.809735%2C56.104052&z=16&l=map&ol=biz&oid=64977620779',
} as const;
