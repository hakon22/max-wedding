import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeddingSiteSettingValueJsonb1778347619652 implements MigrationInterface {
  public name = 'WeddingSiteSettingValueJsonb1778347619652';

  public up = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query(`
      CREATE TABLE "public"."wedding_site_setting" (
        "setting_key" character varying(64) NOT NULL,
        "value" jsonb NOT NULL,
        "updated" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wedding_site_setting" PRIMARY KEY ("setting_key")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "public"."wedding_site_setting" ("setting_key", "value")
      VALUES ('hearts_background', 'true'::jsonb)
    `);
  };

  public down = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query('DROP TABLE IF EXISTS "public"."wedding_site_setting"');
  };
}
