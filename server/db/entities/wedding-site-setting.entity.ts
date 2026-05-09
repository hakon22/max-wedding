import { BaseEntity, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Параметры отображения лендинга, управляемые из админки (Telegram и т.д.) */
@Entity({
  name: 'wedding_site_setting',
  schema: 'public',
})
export class WeddingSiteSettingEntity extends BaseEntity {
  /** Ключ параметра */
  @PrimaryColumn('character varying', {
    name: 'setting_key',
    length: 64,
  })
  public settingKey: string;

  /** Значение параметра (JSONB; для флагов — литерал true/false) */
  @Column('jsonb')
  public value: unknown;

  /** Момент последнего обновления */
  @UpdateDateColumn({ type: 'timestamp without time zone' })
  public updated: Date;
}
