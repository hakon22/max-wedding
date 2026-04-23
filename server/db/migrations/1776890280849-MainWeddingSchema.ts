import { MigrationInterface, QueryRunner } from 'typeorm';

export class MainWeddingSchema1776890280849 implements MigrationInterface {
  public name = 'MainWeddingSchema1776890280849';

  public up = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query('CREATE TYPE "public"."user_role_enum" AS ENUM(\'USER\', \'ADMIN\')');

    await queryRunner.query(`
      CREATE TABLE "public"."user" (
        "id" SERIAL NOT NULL,
        "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted" TIMESTAMP WITH TIME ZONE,
        "telegram_id" BIGINT NOT NULL,
        "username" CHARACTER VARYING,
        "display_name" CHARACTER VARYING,
        "first_name" CHARACTER VARYING,
        "last_name" CHARACTER VARYING,
        "role" "public"."user_role_enum" NOT NULL DEFAULT 'USER',
        "last_seen_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_telegram_id" UNIQUE ("telegram_id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "public"."guest_submission" (
        "id" SERIAL NOT NULL,
        "created" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        "updated" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        "deleted" TIMESTAMP WITHOUT TIME ZONE,
        "guest_name" CHARACTER VARYING,
        "plans_to_attend" boolean NOT NULL DEFAULT true,
        "with_children" boolean NOT NULL DEFAULT false,
        "needs_overnight_stay" boolean NOT NULL DEFAULT false,
        "message" text,
        "main_course_code" character varying,
        "source" character varying NOT NULL DEFAULT 'web',
        CONSTRAINT "PK_guest_submission" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "public"."guest_submission_drink" (
        "id" SERIAL NOT NULL,
        "submission_id" integer NOT NULL,
        "drink_code" character varying NOT NULL,
        CONSTRAINT "PK_guest_submission_drink" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guest_submission_drink_submission" FOREIGN KEY ("submission_id")
          REFERENCES "public"."guest_submission"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`);
  };

  public down = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query('DROP TABLE "public"."guest_submission_drink"');
    await queryRunner.query('DROP TABLE "public"."guest_submission"');
    await queryRunner.query('DROP TABLE "public"."user"');
    await queryRunner.query('DROP TYPE "public"."user_role_enum"');
  };
}
