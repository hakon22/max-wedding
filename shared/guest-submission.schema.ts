import * as yup from 'yup';

import { DRINK_CODES, MAIN_COURSE_CODES } from '@shared/guest-menu-codes';

const drinkCodeSchema = yup
  .string()
  .oneOf([...DRINK_CODES], 'Недопустимый напиток')
  .required('Недопустимый напиток');

/** Предпочтения гостя, если планирует присутствовать */
export const guestPreferencesAttendingSchema = yup
  .object({
    mainCourseCode: yup
      .string()
      .oneOf([...MAIN_COURSE_CODES], 'Выберите основное блюдо')
      .required('Выберите основное блюдо'),
    withChildren: yup.boolean().required('Недопустимое значение'),
    needsOvernightStay: yup.boolean().required('Недопустимое значение'),
    message: yup
      .string()
      .transform((v) => (v == null || typeof v !== 'string' ? '' : v.trim()))
      .max(500, 'Максимум 500 символов')
      .optional(),
    drinkCodes: yup
      .array()
      .of(drinkCodeSchema)
      .min(1, 'Выберите хотя бы один вариант напитков')
      .required('Выберите хотя бы один вариант напитков'),
  })
  .required();

/** Минимальные поля, если гость не планирует присутствовать */
export const guestPreferencesAbsentSchema = yup
  .object({
    withChildren: yup.boolean().required().oneOf([false], 'Недопустимое значение'),
    needsOvernightStay: yup.boolean().required().oneOf([false], 'Недопустимое значение'),
    message: yup
      .string()
      .transform((v) => (v == null || typeof v !== 'string' ? '' : v.trim()))
      .max(500, 'Максимум 500 символов')
      .optional(),
    drinkCodes: yup
      .array()
      .of(drinkCodeSchema)
      .length(0, 'Напитки не заполняются, если вы не придёте')
      .required('Напитки не заполняются, если вы не придёте'),
  })
  .required();

export type GuestPreferencesAttending = yup.InferType<typeof guestPreferencesAttendingSchema>;
export type GuestPreferencesAbsent = yup.InferType<typeof guestPreferencesAbsentSchema>;

/**
 * Тело POST /api/submissions — единая схема для бекенда и фронтенда
 */
export const guestSubmissionRequestSchema = yup
  .object({
    guestName: yup
      .string()
      .transform((v) => (v == null || typeof v !== 'string' ? '' : v.trim()))
      .min(2, 'Как минимум 2 буквы')
      .required('Укажите имя и фамилию'),
    plansToAttend: yup.boolean().required('Укажите, планируете ли вы присутствовать'),
    preferences: yup.mixed().when('plansToAttend', {
      is: false,
      then: () => guestPreferencesAbsentSchema,
      otherwise: () => guestPreferencesAttendingSchema,
    }),
  })
  .required();

export type GuestSubmissionRequest = yup.InferType<typeof guestSubmissionRequestSchema>;
