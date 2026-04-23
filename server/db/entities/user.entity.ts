import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Роль пользователя Telegram в контексте свадебного бота */
export enum UserRoleEnum {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/** Пользователь Telegram (админы — role ADMIN в БД). «Отключённые» — через мягкое удаление (`deleted`). */
@Entity({
  name: 'user',
  schema: 'public',
})
export class UserEntity extends BaseEntity {
  /** ID пользователя */
  @PrimaryGeneratedColumn()
  public id: number;

  /** Момент создания */
  @CreateDateColumn()
  public created: Date;

  /** Момент последнего обновления */
  @UpdateDateColumn()
  public updated: Date;

  /** Момент мягкого удаления; null — пользователь активен */
  @DeleteDateColumn()
  public deleted: Date | null;

  /** Telegram ID пользователя */
  @Column('bigint', {
    name: 'telegram_id',
    unique: true,
  })
  public telegramId: string;

  /** Telegram username пользователя */
  @Column('character varying', {
    nullable: true,
  })
  public username: string | null;

  /** Отображаемое имя пользователя */
  @Column('character varying', {
    name: 'display_name',
    nullable: true,
  })
  public displayName: string | null;

  /** Имя пользователя */
  @Column('character varying', {
    name: 'first_name',
    nullable: true,
  })
  public firstName: string | null;

  /** Фамилия пользователя */
  @Column('character varying', {
    name: 'last_name',
    nullable: true,
  })
  public lastName: string | null;

  /** Роль пользователя */
  @Column('enum', {
    enum: UserRoleEnum,
    enumName: 'user_role_enum',
    default: UserRoleEnum.USER,
  })
  public role: UserRoleEnum;

  /** Момент последнего видимого пользователем */
  @Column('timestamptz', {
    name: 'last_seen_at',
    nullable: true,
  })
  public lastSeenAt: Date | null;
}
