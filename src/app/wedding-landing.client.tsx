'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { App, Button, Card, Carousel, Checkbox, Form, Input, Radio, Select, Typography, message } from 'antd';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { LanguageSwitcher } from '@/components/language-switcher';
import { apiClient } from '@/lib/api-client';
import {
  formValuesToGuestSubmissionBody,
  type GuestSubmissionFormValues,
  type GuestSubmissionResolveValidationMessage,
  validateGuestSubmissionOnClient,
} from '@/lib/guest-submission-yup-form';
import styles from '@/app/wedding-landing.module.css';
import type { MenuCatalogDto } from '@shared/menu-catalog';
import type { SiteDisplaySettingsDto } from '@shared/wedding-site-settings';
import { weddingSiteConfig } from '@shared/wedding-site-config';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

type WishSlide = {
  title: string;
  body: string;
};

type TimingItem = {
  time: string;
  label: string;
};

type CalendarStrings = {
  weekdays: string[];
  monthNames: string[];
};

type CalendarCell = {
  day: number | null;
  inMonth: boolean;
  /** Пустые клетки до/после месяца — как в макете: белые скругления */
  pad: 'lead' | 'trail' | null;
};

type WeddingLandingProps = {
  menuCatalog: MenuCatalogDto;
  siteDisplaySettings: SiteDisplaySettingsDto;
};

/** Обводка ячейки в форме сердца (не сдвигает цифру — абсолютное позиционирование) */
const CALENDAR_WEDDING_HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

const DRESS_CODE_PALETTE = [
  { id: 'choko', src: '/wedding/choko.png' },
  { id: 'currant', src: '/wedding/currant.png' },
  { id: 'mint', src: '/wedding/mitn.png' },
  { id: 'raspberry', src: '/wedding/raspberry.png' },
] as const;

const CalendarWeddingHeartOutline = (): ReactNode => (
  <svg
    className={styles.cellWeddingHeartStroke}
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
  >
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinejoin="round"
      strokeLinecap="round"
      d={CALENDAR_WEDDING_HEART_PATH}
    />
  </svg>
);

const buildCalendarCells = (year: number, monthIndex: number): CalendarCell[] => {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells: CalendarCell[] = [];
  for (let leadingCellIndex = 0; leadingCellIndex < leading; leadingCellIndex += 1) {
    cells.push({ day: null, inMonth: false, pad: 'lead' });
  }
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    cells.push({ day: dayOfMonth, inMonth: true, pad: null });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, inMonth: false, pad: 'trail' });
  }
  return cells;
};

const WeddingCalendar = (): ReactNode => {
  const { t } = useTranslation();
  const calendarStrings = t('weddingLanding.calendar', { returnObjects: true }) as unknown as CalendarStrings;
  const { weddingYear, weddingMonthIndex, weddingDay } = weddingSiteConfig;
  const cells = buildCalendarCells(weddingYear, weddingMonthIndex);
  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarHeader}>
        {calendarStrings.monthNames[weddingMonthIndex]} {weddingYear}
      </div>
      <div className={styles.weekdays}>
        {calendarStrings.weekdays.map((weekdayLabel) => (
          <span key={weekdayLabel}>{weekdayLabel}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {cells.map((calendarCell, cellIndex) => {
          const isWeddingDayCell = calendarCell.inMonth && calendarCell.day === weddingDay;
          const isPadCell = calendarCell.pad !== null;
          const cellClassName = [
            styles.cell,
            isPadCell ? styles.cellPad : '',
            calendarCell.inMonth && !isWeddingDayCell ? styles.cellDay : '',
            isWeddingDayCell ? styles.cellWedding : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={`${cellIndex}-${calendarCell.day ?? calendarCell.pad ?? 'x'}`} className={cellClassName}>
              {isWeddingDayCell ? <CalendarWeddingHeartOutline /> : null}
              {calendarCell.day != null ? (
                <span className={styles.cellDayMark}>{calendarCell.day}</span>
              ) : (
                '\u00a0'
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Лендинг свадьбы: секции по ТЗ и анкета гостя
 */
/** Как в макете: «23 / 08 / 2026» (пробел вокруг слешей) */
const formatHeroPhotoDateLine = (): string => {
  const { weddingDay, weddingMonthIndex, weddingYear } = weddingSiteConfig;
  const dd = String(weddingDay).padStart(2, '0');
  const mm = String(weddingMonthIndex + 1).padStart(2, '0');
  return `${dd} / ${mm} / ${weddingYear}`;
};

/** Сообщения yup в `guest-submission.schema` (рус.) → ключи i18n */
const buildResolveGuestSubmissionValidation = (t: TFunction): GuestSubmissionResolveValidationMessage => {
  return ({ yupPath, yupMessage, isFormLevel }) => {
    if (isFormLevel) {
      return t('weddingLanding.form.validation.checkFields');
    }
    const p = yupPath ?? '';
    if (p === 'guestName') {
      if (yupMessage === 'Как минимум 2 буквы') {
        return t('weddingLanding.form.validation.guestNameMin');
      }
      return t('weddingLanding.form.validation.guestNameRequired');
    }
    if (p === 'plansToAttend') {
      return t('weddingLanding.form.validation.plansToAttend');
    }
    if (p === 'preferences.mainCourseId' || p.endsWith('.mainCourseId')) {
      return t('weddingLanding.form.validation.mainCourseRequired');
    }
    if (p.includes('drinkIds')) {
      if (yupMessage === 'Недопустимый напиток') {
        return t('weddingLanding.form.validation.drinkInvalid');
      }
      if (yupMessage === 'Напитки не заполняются, если вы не придёте') {
        return t('weddingLanding.form.validation.drinksWhenNotAttending');
      }
      return t('weddingLanding.form.validation.drinksMin');
    }
    if (p.includes('message')) {
      return t('weddingLanding.form.validation.messageMax');
    }
    if (p.includes('withChildren') || p.includes('needsOvernightStay')) {
      if (yupMessage === 'Недопустимое значение') {
        return t('weddingLanding.form.validation.invalidValue');
      }
    }
    if (
      p.includes('mainCourseId') ||
      (yupMessage.toLowerCase().includes('is a required field') && p.toLowerCase().includes('maincourse'))
    ) {
      return t('weddingLanding.form.validation.mainCourseRequired');
    }
    if (yupMessage.toLowerCase().includes('maincourseid') && yupMessage.toLowerCase().includes('required')) {
      return t('weddingLanding.form.validation.mainCourseRequired');
    }
    return yupMessage;
  };
};

const RU_GUEST_SUBMISSION_API_ERROR_TO_I18N: [string, string][] = [
  ['Укажите, планируете ли вы присутствовать', 'weddingLanding.form.validation.plansToAttend'],
  ['Как минимум 2 буквы', 'weddingLanding.form.validation.guestNameMin'],
  ['Напитки не заполняются, если вы не придёте', 'weddingLanding.form.validation.drinksWhenNotAttending'],
  ['Выберите хотя бы один вариант напитков', 'weddingLanding.form.validation.drinksMin'],
  ['Выберите основное блюдо', 'weddingLanding.form.validation.mainCourseRequired'],
  ['Укажите имя и фамилию', 'weddingLanding.form.validation.guestNameRequired'],
  ['Максимум 500 символов', 'weddingLanding.form.validation.messageMax'],
  ['Недопустимый напиток', 'weddingLanding.form.validation.drinkInvalid'],
  ['Выбран недопустимый напиток', 'weddingLanding.form.validation.drinkInvalid'],
  ['Выбрано недопустимое основное блюдо', 'weddingLanding.form.validation.mainCourseRequired'],
  ['Недопустимое значение', 'weddingLanding.form.validation.invalidValue'],
];

const translateRawGuestSubmissionApiError = (raw: string, t: TFunction): string => {
  const byLength = [...RU_GUEST_SUBMISSION_API_ERROR_TO_I18N].sort((a, b) => b[0].length - a[0].length);
  let out = raw;
  for (const [russian, key] of byLength) {
    if (out.includes(russian)) {
      out = out.split(russian).join(t(key));
    }
  }
  return out;
};

const WeddingLandingClient = ({ menuCatalog, siteDisplaySettings }: WeddingLandingProps): ReactNode => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm<GuestSubmissionFormValues>();
  const plansToAttend = Form.useWatch('plansToAttend', form);
  const showGuestDetails = plansToAttend !== false;
  const resolveGuestSubmissionValidation = useMemo(() => buildResolveGuestSubmissionValidation(t), [t]);
  const wishesSlides = t('weddingLanding.wishesSlides', { returnObjects: true }) as unknown as WishSlide[];
  const timingItems = t('weddingLanding.timing', { returnObjects: true }) as unknown as TimingItem[];
  const weddingVideoRef = useRef<HTMLVideoElement>(null);
  const videoSectionRef = useRef<HTMLElement>(null);
  /** IO только на ряд ягод — иначе секция с заголовком срабатывает раньше, чем картинки в кадре */
  const dressCodePaletteRevealRef = useRef<HTMLDivElement>(null);
  const dressCodeRevealDoneRef = useRef(false);
  const [isDressCodeVisible, setIsDressCodeVisible] = useState(false);
  const [isDressCodeNapkinHovered, setIsDressCodeNapkinHovered] = useState(false);
  const [isWeddingVideoSurfaceReady, setIsWeddingVideoSurfaceReady] = useState(false);
  const showDressCodePalette = isDressCodeVisible;
  const mainCourseOptions = useMemo(
    () =>
      menuCatalog.mainCourses.map((mainCourse) => ({
        value: mainCourse.id,
        label: i18n.language.startsWith('en') ? mainCourse.labelEn : mainCourse.labelRu,
      })),
    [i18n.language, menuCatalog.mainCourses],
  );
  const drinkOptions = useMemo(
    () =>
      menuCatalog.drinks.map((drink) => ({
        value: drink.id,
        label: i18n.language.startsWith('en') ? drink.labelEn : drink.labelRu,
      })),
    [i18n.language, menuCatalog.drinks],
  );

  useEffect(() => {
    const video = weddingVideoRef.current;
    if (!video) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.42, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  /**
   * Ролик внизу страницы: не тянем байты на первом экране (preload="none"),
   * затем после window.load и в idle поднимаем preload до auto — буфер к моменту скролла.
   */
  useEffect(() => {
    let cancelled = false;

    const kickPreload = (): void => {
      const el = weddingVideoRef.current;
      if (cancelled || !el) {
        return;
      }
      el.preload = 'auto';
      el.load();
    };

    const schedulePreload = (): void => {
      if (cancelled) {
        return;
      }
      const ric = window.requestIdleCallback;
      if (typeof ric === 'function') {
        ric(() => kickPreload(), { timeout: 5000 });
      } else {
        window.setTimeout(kickPreload, 2500);
      }
    };

    if (document.readyState === 'complete') {
      schedulePreload();
    } else {
      window.addEventListener('load', schedulePreload, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedulePreload);
    };
  }, []);

  useLayoutEffect(() => {
    const paletteEl = dressCodePaletteRevealRef.current;
    if (!paletteEl) {
      return;
    }

    const ioRef: { current: IntersectionObserver | null } = { current: null };

    const commitDressCodeReveal = (): void => {
      if (dressCodeRevealDoneRef.current) {
        return;
      }
      dressCodeRevealDoneRef.current = true;
      ioRef.current?.disconnect();
      ioRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsDressCodeVisible(true);
        });
      });
    };

    ioRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.target !== paletteEl) {
            return;
          }
          /*
           * На мобильных нельзя требовать большой intersectionRatio: у WebKit/Safari он
           * нестабилен; плюс transform «вниз» на самом элементе сдвигает bounding box и IO
           * может не сработать — см. CSS: скрытое состояние без translate на цели IO.
           */
          commitDressCodeReveal();
        });
      },
      { threshold: [0, 0.05, 0.12, 0.2], rootMargin: '0px 0px -8% 0px' },
    );

    ioRef.current.observe(paletteEl);

    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
      dressCodeRevealDoneRef.current = false;
    };
  }, []);

  const heroDateLine = formatHeroPhotoDateLine();
  const heroDateAria = heroDateLine.replaceAll(/\s*\/\s*/g, '.');

  const onFinish = async (values: GuestSubmissionFormValues): Promise<void> => {
    const isValid = await validateGuestSubmissionOnClient(
      form,
      values,
      (errorMessageText) => {
        message.error(errorMessageText);
      },
      resolveGuestSubmissionValidation,
    );
    if (!isValid) {
      return;
    }
    const body = formValuesToGuestSubmissionBody(values);
    type SubmitResponse = { ok: boolean; id?: number; error?: string };
    try {
      const { data } = await apiClient.post<SubmitResponse>('/api/submissions', body);
      if (data.ok) {
        message.success(t('weddingLanding.form.submitSuccess'));
        form.resetFields();
        form.setFieldsValue({
          plansToAttend: true,
          withChildren: false,
          needsOvernightStay: false,
          drinkIds: [],
          message: undefined,
        });
        queueMicrotask(() => {
          videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        const err = data.error ?? t('weddingLanding.form.submitError');
        message.error(translateRawGuestSubmissionApiError(err, t));
      }
    } catch (error) {
      if (
        isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data === 'object' &&
        error.response.data !== null
      ) {
        const payload = error.response.data as { error?: string };
        const err = payload.error ?? t('weddingLanding.form.submitError');
        message.error(translateRawGuestSubmissionApiError(err, t));
      } else {
        message.error(t('weddingLanding.form.submitError'));
      }
    }
  };

  const heartsOn = siteDisplaySettings.heartsBackgroundEnabled;

  return (
    <div className={`${styles.landingRoot} ${heartsOn ? styles.landingRootWithHearts : ''}`}>
      <LanguageSwitcher />
      <header
        className={`${styles.hero} ${heartsOn ? styles.heroWithHearts : ''}`}
        style={
          {
            '--hero-object-position': weddingSiteConfig.heroImageObjectPosition,
          } as CSSProperties
        }
      >
        <div className={styles.heroImageMotion}>
          <Image
            src={weddingSiteConfig.heroImageSrc}
            alt=""
            fill
            priority
            className={styles.heroImage}
            sizes="100vw"
          />
        </div>
        <div className={styles.heroOverlay} />
        <div className={styles.heroText}>
          <h1 className={styles.heroNames}>
            <span className={styles.heroNameLine1}>{t('weddingLanding.hero.nameLine1')}</span>
            <span className={styles.heroNameLine2}>
              <span className={styles.heroAmp}>и</span>
              {t('weddingLanding.hero.nameLine2')}
            </span>
          </h1>
          <p className={styles.heroDate} aria-label={heroDateAria}>
            {heroDateLine}
          </p>
        </div>
      </header>

      <div className={styles.page}>
        <section className={styles.section}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.invitation')}
          </Title>
          <Paragraph className={styles.intro}>{t('weddingLanding.intro')}</Paragraph>
        </section>

        <section className={`${styles.section} ${styles.sectionCalendar}`}>
          <WeddingCalendar />
        </section>

        <section className={styles.section}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.venue')}
          </Title>
          <div className={styles.venueCard}>
            <Title level={4} style={{ marginTop: 0 }}>
              {t('weddingLanding.venue.cardHeading')}
            </Title>
            <Paragraph style={{ marginBottom: 8 }}>{t('weddingLanding.venue.addressLine1')}</Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>{t('weddingLanding.venue.addressLine2')}</Paragraph>
            <div className={styles.venueLocationPhoto}>
              <Image
                src="/wedding/location.JPG"
                alt={t('weddingLanding.venue.locationPhotoAlt')}
                fill
                sizes="(max-width: 640px) calc(100vw - 48px), 520px"
                className={styles.venueLocationPhotoImg}
              />
            </div>
            <Button
              type="primary"
              className={styles.venueMapButton}
              size="large"
              block
              href={weddingSiteConfig.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('weddingLanding.venue.mapOpenButton')}
            </Button>
          </div>
        </section>

        <section className={styles.section}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.overnight')}
          </Title>
          <div className={styles.overnight}>{t('weddingLanding.overnightNote')}</div>
        </section>

        <section className={`${styles.section} ${styles.sectionTiming}`}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.timing')}
          </Title>
          <div className={styles.timingPanel}>
            <svg className={styles.timingArc} viewBox="0 0 420 520" preserveAspectRatio="xMinYMax meet" aria-hidden>
              <path
                d="M -8 512 C 48 180, 220 72, 412 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
            </svg>
            <ul className={styles.timingList}>
              {timingItems.map((timingItem) => (
                <li key={`${timingItem.time}-${timingItem.label}`} className={styles.timingRow}>
                  <span className={styles.timingTime}>{timingItem.time}</span>
                  <span className={styles.timingLabel}>{timingItem.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionDressCode}`}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.dressCode')}
          </Title>
          <div className={styles.dressCodeHeroOuter}>
            <div className={styles.dressCodeHero}>
              <div className={styles.dressCodeHeroFigure}>
                <Image
                  src="/wedding/dress-code.jpeg"
                  alt=""
                  aria-hidden
                  width={1600}
                  height={900}
                  className={styles.dressCodeHeroImage}
                  sizes="(max-width: 768px) 92vw, 760px"
                />
                {/* ПК: салфетка открывает ряд иконок по центру кадра, поверх фото; палитра под кадром — только по скроллу */}
                <div
                  className={styles.dressCodeNapkinHit}
                  aria-hidden
                  onMouseEnter={() => setIsDressCodeNapkinHovered(true)}
                  onMouseLeave={() => setIsDressCodeNapkinHovered(false)}
                />
                <div
                  className={`${styles.dressCodeNapkinHoverLayer} ${
                    isDressCodeNapkinHovered ? styles.dressCodeNapkinHoverLayerVisible : ''
                  }`}
                  aria-hidden
                >
                  <div className={styles.dressCodeNapkinHoverPanel}>
                    <div className={styles.dressCodeNapkinHoverRow}>
                      {DRESS_CODE_PALETTE.map((paletteSwatch) => (
                        <div key={`napkin-${paletteSwatch.src}`} className={styles.dressCodeNapkinHoverItem}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={paletteSwatch.src}
                            alt=""
                            width={220}
                            height={220}
                            className={styles.dressCodeNapkinHoverImage}
                            loading="lazy"
                            decoding="async"
                          />
                          <span className={styles.dressCodeNapkinHoverLabel}>
                            {t(`weddingLanding.dressCode.paletteColors.${paletteSwatch.id}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Paragraph className={styles.dressCodeIntro}>{t('weddingLanding.dressCode.intro')}</Paragraph>
              </div>
            </div>
            <div
              ref={dressCodePaletteRevealRef}
              className={`${styles.dressCodePalette} ${showDressCodePalette ? styles.dressCodePaletteVisible : ''}`}
            >
              {DRESS_CODE_PALETTE.map((paletteSwatch) => (
                <div key={paletteSwatch.src} className={styles.dressCodePaletteItem}>
                  {/* next/image даёт span с фоном под оптимизацией — для PNG с альфой нужен нативный img */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paletteSwatch.src}
                    alt=""
                    width={210}
                    height={210}
                    className={styles.dressCodePaletteImage}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className={styles.dressCodePaletteLabel}>
                    {t(`weddingLanding.dressCode.paletteColors.${paletteSwatch.id}`)}
                  </span>
                </div>
              ))}
              <Paragraph className={styles.dressCodePaletteNote}>{t('weddingLanding.dressCode.paletteNote')}</Paragraph>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.wishes')}
          </Title>
          <div className={styles.wishesCarouselWrap}>
            <Carousel className={styles.wishesCarousel} arrows autoplay autoplaySpeed={4000} dots>
              {wishesSlides.map((wishSlide) => (
                <div key={wishSlide.title}>
                  <div className={styles.wishSlide}>
                    <Title level={4}>{wishSlide.title}</Title>
                    <Paragraph style={{ marginBottom: 0 }}>{wishSlide.body}</Paragraph>
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        </section>

        <section className={`${styles.section} ${styles.formSection}`} id="anketa">
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.form')}
          </Title>
          <Card className={styles.formCard}>
            <Paragraph className={styles.deadlineNote}>{t('weddingLanding.formDeadlineLabel')}</Paragraph>
            <Form<GuestSubmissionFormValues>
              form={form}
              layout="vertical"
              initialValues={{
                plansToAttend: true,
                withChildren: false,
                needsOvernightStay: false,
                drinkIds: [],
              }}
              onValuesChange={(changedValues) => {
                if ('plansToAttend' in changedValues && changedValues.plansToAttend === false) {
                  form.setFieldsValue({
                    mainCourseId: undefined,
                    drinkIds: [],
                    withChildren: false,
                    needsOvernightStay: false,
                    message: undefined,
                  });
                }
              }}
              onFinish={onFinish}
            >
              <Form.Item label={t('weddingLanding.form.guestNameLabel')} name="guestName" required>
                <Input
                  placeholder={t('weddingLanding.form.guestNamePlaceholder')}
                  size="large"
                  allowClear
                  autoComplete="name"
                />
              </Form.Item>
              <Form.Item
                className={styles.plansToAttendFormItem}
                label={t('weddingLanding.form.plansToAttendLabel')}
                name="plansToAttend"
                rules={[{ required: true, message: t('weddingLanding.form.plansToAttendRequired') }]}
              >
                <Radio.Group className={styles.plansToAttendGroup} size="large" buttonStyle="solid">
                  <Radio.Button value={true}>{t('weddingLanding.form.plansToAttendYes')}</Radio.Button>
                  <Radio.Button value={false}>{t('weddingLanding.form.plansToAttendNo')}</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {showGuestDetails ? (
                <>
                  <Form.Item label={t('weddingLanding.form.mainCourseLabel')} name="mainCourseId" required>
                    <Select
                      size="large"
                      placeholder={t('weddingLanding.form.mainCoursePlaceholder')}
                      options={mainCourseOptions}
                    />
                  </Form.Item>
                  <Form.Item label={t('weddingLanding.form.drinkCodesLabel')} name="drinkIds" required>
                    <Select
                      mode="multiple"
                      allowClear
                      size="large"
                      placeholder={t('weddingLanding.form.drinkCodesPlaceholder')}
                      options={drinkOptions}
                    />
                  </Form.Item>
                  <Form.Item name="withChildren" valuePropName="checked">
                    <Checkbox>{t('weddingLanding.form.withChildren')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="needsOvernightStay" valuePropName="checked">
                    <Checkbox>{t('weddingLanding.form.needsOvernightStay')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="message" label={t('weddingLanding.form.messageLabel')}>
                    <TextArea
                      rows={4}
                      placeholder={t('weddingLanding.form.messagePlaceholder')}
                      showCount
                      maxLength={500}
                    />
                  </Form.Item>
                </>
              ) : (
                <Form.Item name="message" label={t('weddingLanding.form.messageIfAbsentLabel')}>
                  <TextArea
                    rows={3}
                    placeholder={t('weddingLanding.form.messageIfAbsentPlaceholder')}
                    showCount
                    maxLength={500}
                  />
                </Form.Item>
              )}
              <Form.Item className={styles.submitFormItem}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  className={styles.formSubmitButton}
                >
                  {t('weddingLanding.form.submit')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </section>
      </div>

      <section
        ref={videoSectionRef}
        className={styles.videoSection}
      >
        <div
          className={styles.videoWrap}
          style={
            {
              '--wedding-video-aspect-w': weddingSiteConfig.videoLayoutHintWidth,
              '--wedding-video-aspect-h': weddingSiteConfig.videoLayoutHintHeight,
            } as CSSProperties
          }
        >
          {!isWeddingVideoSurfaceReady && (
            <Image
              src={weddingSiteConfig.videoPosterSrc}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 767px) 100vw, 720px"
              quality={75}
              className={styles.videoPoster}
            />
          )}
          <video
            ref={weddingVideoRef}
            className={styles.video}
            loop
            muted
            playsInline
            preload="none"
            style={{ opacity: isWeddingVideoSurfaceReady ? 1 : 0 }}
            onLoadedData={() => setIsWeddingVideoSurfaceReady(true)}
          >
            <source src={weddingSiteConfig.videoSrc} type={weddingSiteConfig.videoMimeType} />
          </video>
        </div>
      </section>
    </div>
  );
};

const WeddingLanding = ({ menuCatalog, siteDisplaySettings }: WeddingLandingProps): ReactNode => {
  return (
    <App>
      <WeddingLandingClient menuCatalog={menuCatalog} siteDisplaySettings={siteDisplaySettings} />
    </App>
  );
};

export default WeddingLanding;
