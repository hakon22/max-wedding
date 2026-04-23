import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import type { MainCourseCode } from '@shared/guest-menu-codes';

/** Источник заявки */
export type GuestSubmissionSource = 'web' | 'telegram' | 'import';

/** Гостевая заявка (шапка + связанные напитки) */
@Entity({
  name: 'guest_submission',
  schema: 'public',
})
export class GuestSubmissionEntity extends BaseEntity {
  /** ID записи */
  @PrimaryGeneratedColumn()
  public id: number;

  /** Момент создания */
  @CreateDateColumn()
  public created: Date;

  /** Момент последнего обновления */
  @UpdateDateColumn()
  public updated: Date;

  /** Момент мягкого удаления; null — запись активна */
  @DeleteDateColumn()
  public deleted: Date | null;

  /** Имя гостя */
  @Column('character varying', {
    name: 'guest_name',
    nullable: true,
  })
  public guestName?: string | null;

  /** Планирует ли гость присутствовать (анкета на сайте) */
  @Column('boolean', {
    name: 'plans_to_attend',
    default: true,
  })
  public plansToAttend: boolean;

  /** Нужны ли дети */
  @Column('boolean', {
    name: 'with_children',
    default: false,
  })
  public withChildren: boolean;

  /** Нужен ночлёг после мероприятия (по запросу гостя в анкете) */
  @Column('boolean', {
    name: 'needs_overnight_stay',
    default: false,
  })
  public needsOvernightStay: boolean;

  @Column('text', { nullable: true })
  public message?: string | null;

  /** Выбранное блюдо; null если гость отметил отсутствие */
  @Column('character varying', {
    name: 'main_course_code',
    nullable: true,
  })
  public mainCourseCode: MainCourseCode | null;

  /** Источник заявки */
  @Column('character varying', {
    default: 'web',
  })
  public source: GuestSubmissionSource;

  /** Выбранные напитки */
  @OneToMany(() => GuestSubmissionDrinkEntity, (row) => row.submission, {
    cascade: true,
  })
  public drinks?: GuestSubmissionDrinkEntity[];
}
