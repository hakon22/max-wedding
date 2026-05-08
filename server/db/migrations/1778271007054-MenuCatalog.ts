import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuCatalog1778271007054 implements MigrationInterface {
  public name = 'MenuCatalog1778271007054';

  public up = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query(`
      CREATE TABLE "public"."menu_main_course" (
        "id" SERIAL NOT NULL,
        "label_ru" CHARACTER VARYING NOT NULL,
        "label_en" CHARACTER VARYING NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        "updated" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_main_course" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "public"."menu_drink" (
        "id" SERIAL NOT NULL,
        "label_ru" CHARACTER VARYING NOT NULL,
        "label_en" CHARACTER VARYING NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        "updated" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_drink" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "public"."menu_main_course" ("label_ru", "label_en", "order", "is_active")
      VALUES
        ('Стейк из говяжьей вырезки', 'Beef tenderloin steak', 0, true),
        ('Каре молодого барашка', 'Lamb rack', 1, true),
        ('Форель гриль', 'Grilled trout', 2, true)
    `);

    await queryRunner.query(`
      INSERT INTO "public"."menu_drink" ("label_ru", "label_en", "order", "is_active")
      VALUES
        ('Вино игристое', 'Sparkling wine', 0, true),
        ('Вино белое', 'White wine', 1, true),
        ('Вино красное', 'Red wine', 2, true),
        ('Виски', 'Whiskey', 3, true),
        ('Коньяк', 'Cognac', 4, true),
        ('Ром', 'Rum', 5, true),
        ('Не пью алкоголь', 'No alcohol', 6, true)
    `);

    await queryRunner.query(`
      ALTER TABLE "public"."guest_submission"
      ADD COLUMN IF NOT EXISTS "main_course_id" integer;
    `);
    await queryRunner.query(`
      ALTER TABLE "public"."guest_submission_drink"
      ADD COLUMN IF NOT EXISTS "drink_id" integer;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'guest_submission' AND column_name = 'main_course_code'
        ) THEN
          UPDATE "public"."guest_submission"
          SET "main_course_id" = CASE "main_course_code"
            WHEN 'beef_tenderloin_steak' THEN 1
            WHEN 'lamb_rack' THEN 2
            WHEN 'grilled_trout' THEN 3
            ELSE "main_course_id"
          END
          WHERE "main_course_id" IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'guest_submission_drink' AND column_name = 'drink_code'
        ) THEN
          UPDATE "public"."guest_submission_drink"
          SET "drink_id" = CASE "drink_code"
            WHEN 'sparkling_wine' THEN 1
            WHEN 'white_wine' THEN 2
            WHEN 'red_wine' THEN 3
            WHEN 'whiskey' THEN 4
            WHEN 'cognac' THEN 5
            WHEN 'rum' THEN 6
            WHEN 'gin' THEN NULL
            WHEN 'no_alcohol' THEN 7
            ELSE "drink_id"
          END
          WHERE "drink_id" IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query('ALTER TABLE "public"."guest_submission" DROP COLUMN IF EXISTS "main_course_code"');
    await queryRunner.query('ALTER TABLE "public"."guest_submission_drink" DROP COLUMN IF EXISTS "drink_code"');
  };

  public down = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query('ALTER TABLE "public"."guest_submission" DROP COLUMN IF EXISTS "main_course_id"');
    await queryRunner.query('ALTER TABLE "public"."guest_submission_drink" DROP COLUMN IF EXISTS "drink_id"');
    await queryRunner.query('DROP TABLE "public"."menu_drink"');
    await queryRunner.query('DROP TABLE "public"."menu_main_course"');
  };
}
