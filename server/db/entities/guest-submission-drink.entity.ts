import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';

/** Одна строка выбранного напитка в заявке (для отчётов и сводок) */
@Entity({
  name: 'guest_submission_drink',
  schema: 'public',
})
export class GuestSubmissionDrinkEntity extends BaseEntity {
  /** ID строки */
  @PrimaryGeneratedColumn()
  public id: number;

  /** Заявка */
  @ManyToOne(() => GuestSubmissionEntity, (submission) => submission.drinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'submission_id',
    referencedColumnName: 'id',
  })
  public submission: GuestSubmissionEntity;

  /** ID напитка */
  @Column('integer', {
    name: 'drink_id',
  })
  public drinkId: number;
}
