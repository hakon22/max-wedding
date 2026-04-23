'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { DRINK_CODES, DRINK_LABELS, MAIN_COURSE_CODES, MAIN_COURSE_LABELS } from '@shared/guest-menu-codes';
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

/** Обводка ячейки в форме сердца (не сдвигает цифру — абсолютное позиционирование) */
const CALENDAR_WEDDING_HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/** viewBox 0 0 72 118 — наклонные «мазки» как на макете wedwed */
const DRESS_CODE_SWATCHES = [
  {
    fill: '#7a8068',
    d: 'M10 26 C26 8 52 12 60 34 L54 94 C46 110 14 102 8 82 C4 58 6 38 10 26 Z',
  },
  {
    fill: '#c47662',
    d: 'M14 10 C40 4 58 20 58 46 L50 104 C40 114 12 98 10 72 C8 48 10 22 14 10 Z',
  },
  {
    fill: '#ebe3d6',
    d: 'M8 22 C32 12 58 24 60 44 L56 96 C52 108 22 104 10 90 C4 72 4 40 8 22 Z',
  },
  {
    fill: '#5c232e',
    d: 'M12 16 C44 8 58 28 56 54 L48 106 C38 116 10 100 8 74 C6 50 8 28 12 16 Z',
  },
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

type FontPreviewId = 'cormorant' | 'playfair' | 'ebGaramond' | 'spectral' | 'philosopher';

const FONT_PREVIEW_ORDER: FontPreviewId[] = ['cormorant', 'playfair', 'ebGaramond', 'spectral', 'philosopher'];

const FONT_PREVIEW_CSS_VAR: Record<FontPreviewId, string> = {
  cormorant: 'var(--font-wedding-serif)',
  playfair: 'var(--font-wedding-choice-playfair)',
  ebGaramond: 'var(--font-wedding-choice-eb-garamond)',
  spectral: 'var(--font-wedding-choice-spectral)',
  philosopher: 'var(--font-wedding-choice-philosopher)',
};

/** Имена для подписи в выпадающем списке (шрифты уже подгружены через next/font) */
const FONT_PREVIEW_DROPDOWN_FAMILY: Record<FontPreviewId, string> = {
  cormorant: '"Cormorant Garamond", Georgia, serif',
  playfair: '"Playfair Display", Georgia, serif',
  ebGaramond: '"EB Garamond", Georgia, serif',
  spectral: '"Spectral", Georgia, serif',
  philosopher: '"Philosopher", Georgia, serif',
};

type BodyFontPreviewId = 'geist' | 'merriweather' | 'nunitoSans' | 'comfortaa' | 'neucha';

const BODY_FONT_PREVIEW_ORDER: BodyFontPreviewId[] = ['geist', 'merriweather', 'nunitoSans', 'comfortaa', 'neucha'];

const BODY_FONT_PREVIEW_CSS_VAR: Record<BodyFontPreviewId, string> = {
  geist: 'var(--font-geist)',
  merriweather: 'var(--font-body-choice-merriweather)',
  nunitoSans: 'var(--font-body-choice-nunito-sans)',
  comfortaa: 'var(--font-body-choice-comfortaa)',
  neucha: 'var(--font-body-choice-neucha)',
};

const BODY_FONT_PREVIEW_DROPDOWN_FAMILY: Record<BodyFontPreviewId, string> = {
  geist: 'var(--font-geist), system-ui, sans-serif',
  merriweather: '"Merriweather", Georgia, serif',
  nunitoSans: '"Nunito Sans", system-ui, sans-serif',
  comfortaa: '"Comfortaa", system-ui, sans-serif',
  neucha: '"Neucha", cursive',
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
    if (p === 'preferences.mainCourseCode' || p.endsWith('.mainCourseCode')) {
      return t('weddingLanding.form.validation.mainCourseRequired');
    }
    if (p.includes('drinkCodes')) {
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
      p.includes('mainCourseCode') ||
      (yupMessage.toLowerCase().includes('is a required field') && p.toLowerCase().includes('maincourse'))
    ) {
      return t('weddingLanding.form.validation.mainCourseRequired');
    }
    if (yupMessage.toLowerCase().includes('maincoursecode') && yupMessage.toLowerCase().includes('required')) {
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

const WeddingLandingClient = (): ReactNode => {
  const { t, i18n } = useTranslation();
  const [fontPreviewId, setFontPreviewId] = useState<FontPreviewId>('cormorant');
  const [bodyFontPreviewId, setBodyFontPreviewId] = useState<BodyFontPreviewId>('geist');
  const yandexMapEmbedSrc = useMemo((): string => {
    const url = new URL(weddingSiteConfig.yandexMapEmbedUrl, 'https://yandex.ru');
    url.searchParams.set('lang', i18n.language === 'en' ? 'en_RU' : 'ru_RU');
    return url.toString();
  }, [i18n.language]);
  const [form] = Form.useForm<GuestSubmissionFormValues>();
  const plansToAttend = Form.useWatch('plansToAttend', form);
  const showGuestDetails = plansToAttend !== false;
  const resolveGuestSubmissionValidation = useMemo(() => buildResolveGuestSubmissionValidation(t), [t]);
  const wishesSlides = t('weddingLanding.wishesSlides', { returnObjects: true }) as unknown as WishSlide[];
  const timingItems = t('weddingLanding.timing', { returnObjects: true }) as unknown as TimingItem[];
  const weddingVideoRef = useRef<HTMLVideoElement>(null);
  const videoSectionRef = useRef<HTMLElement>(null);

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

  const heroDateLine = formatHeroPhotoDateLine();
  const heroDateAria = heroDateLine.replaceAll(/\s*\/\s*/g, '.');

  const fontPreviewOptions = useMemo(
    () =>
      FONT_PREVIEW_ORDER.map((fontId) => ({
        value: fontId,
        label: (
          <span style={{ fontFamily: FONT_PREVIEW_DROPDOWN_FAMILY[fontId] }}>
            {t(`weddingLanding.fontPreview.fonts.${fontId}`)}
          </span>
        ),
      })),
    [t, i18n.language],
  );

  const bodyFontPreviewOptions = useMemo(
    () =>
      BODY_FONT_PREVIEW_ORDER.map((fontId) => ({
        value: fontId,
        label: (
          <span style={{ fontFamily: BODY_FONT_PREVIEW_DROPDOWN_FAMILY[fontId] }}>
            {t(`weddingLanding.fontPreview.bodyFonts.${fontId}`)}
          </span>
        ),
      })),
    [t, i18n.language],
  );

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
          drinkCodes: [],
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

  return (
    <div
      className={styles.landingRoot}
      style={
        {
          ['--font-wedding-display' as string]: FONT_PREVIEW_CSS_VAR[fontPreviewId],
          ['--font-wedding-body' as string]: BODY_FONT_PREVIEW_CSS_VAR[bodyFontPreviewId],
        } as CSSProperties
      }
    >
      <div className={styles.fontPreviewBar}>
        <div className={styles.fontPreviewBarRows}>
          <div className={styles.fontPreviewBarRow}>
            <span className={styles.fontPreviewBarLabel}>{t('weddingLanding.fontPreview.headingsLabel')}</span>
            <Select<FontPreviewId>
              className={styles.fontPreviewBarSelect}
              size="middle"
              value={fontPreviewId}
              onChange={setFontPreviewId}
              options={fontPreviewOptions}
              popupMatchSelectWidth={false}
              getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
              aria-label={t('weddingLanding.fontPreview.headingsLabel')}
            />
          </div>
          <div className={styles.fontPreviewBarRow}>
            <span className={styles.fontPreviewBarLabel}>{t('weddingLanding.fontPreview.bodyLabel')}</span>
            <Select<BodyFontPreviewId>
              className={styles.fontPreviewBarSelect}
              size="middle"
              value={bodyFontPreviewId}
              onChange={setBodyFontPreviewId}
              options={bodyFontPreviewOptions}
              popupMatchSelectWidth={false}
              getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
              aria-label={t('weddingLanding.fontPreview.bodyLabel')}
            />
          </div>
        </div>
      </div>
      <LanguageSwitcher />
      <header
        className={styles.hero}
        style={
          {
            '--hero-object-position': weddingSiteConfig.heroImageObjectPosition,
          } as CSSProperties
        }
      >
        <Image
          src={weddingSiteConfig.heroImageSrc}
          alt=""
          fill
          priority
          className={styles.heroImage}
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroText}>
          <h1 className={styles.heroNames}>
            <span className={styles.heroNameLine1}>{t('weddingLanding.hero.nameLine1')}</span>
            <span className={styles.heroNameLine2}>
              <span className={styles.heroAmp}>&</span>
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
            <iframe
              className={styles.venueYandexMap}
              title={t('weddingLanding.venue.mapEmbedTitle')}
              src={yandexMapEmbedSrc}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
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
          <Paragraph className={styles.dressCodeIntro}>{t('weddingLanding.dressCode.intro')}</Paragraph>
          <div className={styles.dressCodePalette} aria-hidden>
            {DRESS_CODE_SWATCHES.map((swatch, swatchIndex) => (
              <div key={swatchIndex} className={styles.dressCodeSwatch}>
                <svg
                  className={styles.dressCodeSwatchSvg}
                  viewBox="0 0 72 118"
                  width={72}
                  height={118}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <path d={swatch.d} fill={swatch.fill} />
                </svg>
              </div>
            ))}
          </div>
          <Paragraph className={styles.dressCodePaletteNote}>{t('weddingLanding.dressCode.paletteNote')}</Paragraph>
        </section>

        <section className={styles.section}>
          <Title level={2} className={styles.sectionTitle}>
            {t('weddingLanding.sections.wishes')}
          </Title>
          <div className={styles.wishesCarouselWrap}>
            <Carousel className={styles.wishesCarousel} arrows autoplay dots>
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
                drinkCodes: [],
              }}
              onValuesChange={(changedValues) => {
                if ('plansToAttend' in changedValues && changedValues.plansToAttend === false) {
                  form.setFieldsValue({
                    mainCourseCode: undefined,
                    drinkCodes: [],
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
                  <Form.Item label={t('weddingLanding.form.mainCourseLabel')} name="mainCourseCode" required>
                    <Select
                      size="large"
                      placeholder={t('weddingLanding.form.mainCoursePlaceholder')}
                      options={MAIN_COURSE_CODES.map((mainCourseCode) => ({
                        value: mainCourseCode,
                        label: MAIN_COURSE_LABELS[mainCourseCode],
                      }))}
                    />
                  </Form.Item>
                  <Form.Item label={t('weddingLanding.form.drinkCodesLabel')} name="drinkCodes" required>
                    <Select
                      mode="multiple"
                      allowClear
                      size="large"
                      placeholder={t('weddingLanding.form.drinkCodesPlaceholder')}
                      options={DRINK_CODES.map((drinkCode) => ({
                        value: drinkCode,
                        label: DRINK_LABELS[drinkCode],
                      }))}
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
        aria-labelledby="wedding-video-heading"
      >
        <div className={styles.videoWrap}>
          <video
            ref={weddingVideoRef}
            className={styles.video}
            controls
            muted
            playsInline
            preload="metadata"
            poster={weddingSiteConfig.videoPosterSrc}
          >
            <source src={weddingSiteConfig.videoSrc} type={weddingSiteConfig.videoMimeType} />
          </video>
          <div className={styles.videoOverlay}>
            <div className={styles.videoOverlayHeader}>
              <h2 id="wedding-video-heading" className={styles.videoOverlayTop}>
                {t('weddingLanding.video.overlay.top')}
              </h2>
              <div className={styles.videoOverlayRule} aria-hidden />
            </div>
            <div className={styles.videoOverlayMain}>
              <p className={styles.videoOverlayWithLove}>{t('weddingLanding.video.overlay.withLove')}</p>
              <p className={styles.videoOverlayNameLarge}>{t('weddingLanding.video.overlay.nameFirst')}</p>
              <p className={styles.videoOverlayConj}>{t('weddingLanding.video.overlay.conjunction')}</p>
              <p className={styles.videoOverlayNameLarge}>{t('weddingLanding.video.overlay.nameSecond')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const WeddingLanding = (): ReactNode => {
  return (
    <App>
      <WeddingLandingClient />
    </App>
  );
};

export default WeddingLanding;
