import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Справочник основных блюд меню */
@Entity({
  name: 'menu_main_course',
  schema: 'public',
})
export class MenuMainCourseEntity extends BaseEntity {
  /** ID записи */
  @PrimaryGeneratedColumn()
  public id: number;

  /** Название на русском */
  @Column('character varying', { name: 'label_ru' })
  public labelRu: string;

  /** Название на английском (заполняется автоматически) */
  @Column('character varying', { name: 'label_en' })
  public labelEn: string;

  /** Порядок сортировки, начиная с 0 */
  @Column('integer', { default: 0 })
  public order: number;

  /** Доступна ли позиция для выбора гостем */
  @Column('boolean', { name: 'is_active', default: true })
  public isActive: boolean;

  /** Момент создания */
  @CreateDateColumn({ type: 'timestamp without time zone' })
  public created: Date;

  /** Момент последнего обновления */
  @UpdateDateColumn({ type: 'timestamp without time zone' })
  public updated: Date;
}
