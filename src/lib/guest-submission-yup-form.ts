import * as yup from 'yup';
import type { FormInstance } from 'antd';
import type { NamePath } from 'antd/es/form/interface';

import { guestSubmissionRequestSchema } from '@shared/guest-submission.schema';

const PREF_KEYS = new Set(['mainCourseId', 'withChildren', 'needsOvernightStay', 'message', 'drinkIds']);

export type GuestSubmissionResolveValidationMessage = (args: {
  yupPath?: string;
  yupMessage: string;
  isFormLevel: boolean;
}) => string;

/** Плоские поля формы (совпадают с Form.Item name) */
export type GuestSubmissionFormValues = {
  guestName?: string;
  plansToAttend?: boolean;
  mainCourseId?: number;
  withChildren?: boolean;
  needsOvernightStay?: boolean;
  message?: string;
  drinkIds?: number[];
};

/**
 * Собирает тело запроса из полей Ant Design (плоская форма) для общей yup-схемы
 * @param values - значения формы
 * @returns тело guestSubmissionRequestSchema
 */
export const formValuesToGuestSubmissionBody = (values: GuestSubmissionFormValues) => {
  const guestName = values.guestName;
  if (values.plansToAttend === false) {
    return {
      guestName,
      plansToAttend: false as const,
      preferences: {
        withChildren: false as const,
        needsOvernightStay: false as const,
        message: typeof values.message === 'string' ? values.message : '',
        drinkIds: [] as number[],
      },
    };
  }
  return {
    guestName,
    plansToAttend: true as const,
    preferences: {
      mainCourseId: values.mainCourseId,
      withChildren: values.withChildren ?? false,
      needsOvernightStay: values.needsOvernightStay ?? false,
      message: values.message,
      drinkIds: values.drinkIds ?? [],
    },
  };
};

/**
 * Сопоставляет path yup (из ValidationError) с name Form.Item
 * @param yupPath - err.path
 * @returns name для setFields
 */
const yupPathToFormName = (yupPath: string | undefined): NamePath<GuestSubmissionFormValues> | null => {
  if (yupPath === undefined || yupPath.length === 0) {
    return null;
  }
  if (yupPath === 'guestName' || yupPath === 'plansToAttend') {
    return yupPath;
  }
  if (yupPath.startsWith('drinkIds')) {
    return 'drinkIds';
  }
  const m = /^preferences\.(.+)$/.exec(yupPath);
  if (m) {
    const sub = m[1].split('.')[0].split('[')[0] ?? m[1];
    if (sub === 'drinkIds' || sub.startsWith('drinkIds')) {
      return 'drinkIds';
    }
    if (PREF_KEYS.has(sub)) {
      if (
        sub === 'mainCourseId' ||
        sub === 'withChildren' ||
        sub === 'needsOvernightStay' ||
        sub === 'message' ||
        sub === 'drinkIds'
      ) {
        return sub;
      }
    }
  }
  return null;
};

/**
 * Клиентская валидация той же схемы + подсветка полей формы
 * @param form - экземпляр antd Form
 * @param values - значения формы
 * @param onErrorMessage - если не удалось привязать к полю
 * @param resolveMessage - подписать сообщения yup на язык пользователя; без неё остаётся текст из схемы
 * @returns true если валидно
 */
export const validateGuestSubmissionOnClient = async (
  form: FormInstance<GuestSubmissionFormValues>,
  values: GuestSubmissionFormValues,
  onErrorMessage: (errorMessageText: string) => void,
  resolveMessage?: GuestSubmissionResolveValidationMessage,
): Promise<boolean> => {
  const body = formValuesToGuestSubmissionBody(values);
  try {
    await guestSubmissionRequestSchema.validate(body, { abortEarly: false, stripUnknown: true });
    return true;
  } catch (validationFailure) {
    if (!(validationFailure instanceof yup.ValidationError)) {
      onErrorMessage(
        resolveMessage
          ? resolveMessage({ yupPath: undefined, yupMessage: String(validationFailure), isFormLevel: true })
          : 'Проверьте поля формы',
      );
      return false;
    }
    if (validationFailure.inner.length === 0) {
      onErrorMessage(
        resolveMessage
          ? resolveMessage({
            yupPath: validationFailure.path,
            yupMessage: validationFailure.message,
            isFormLevel: true,
          })
          : 'Проверьте поля формы',
      );
      return false;
    }
    validationFailure.inner.forEach((fieldValidationError) => {
      const name = yupPathToFormName(fieldValidationError.path);
      const text = resolveMessage
        ? resolveMessage({
          yupPath: fieldValidationError.path,
          yupMessage: fieldValidationError.message,
          isFormLevel: false,
        })
        : fieldValidationError.message;
      if (name) {
        form.setFields([{ name, errors: [text] }]);
      } else {
        onErrorMessage(text);
      }
    });
    return false;
  }
};
