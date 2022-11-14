
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableRelationCascading1668446646237 implements MigrationInterface {

    name = 'AlterTableRelationCascading1668446646237';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteDownQueryRunner(queryRunner);
        } else {
            await this.postgresDownQueryRunner(queryRunner);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "skill_employee" DROP CONSTRAINT "FK_760034f54e598d519b5f0c4ecee"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" DROP CONSTRAINT "FK_e699b50ca468e75bbd36913dccb"`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" DROP CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" DROP CONSTRAINT "FK_61593ade5fed9445738ddbe39c4"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" DROP CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" ADD CONSTRAINT "FK_760034f54e598d519b5f0c4ecee" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "skill_employee" ADD CONSTRAINT "FK_e699b50ca468e75bbd36913dccb" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" ADD CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "skill_organization" ADD CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "skill_organization" ADD CONSTRAINT "FK_61593ade5fed9445738ddbe39c4" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "skill_organization" DROP CONSTRAINT "FK_61593ade5fed9445738ddbe39c4"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" DROP CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca"`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" DROP CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" DROP CONSTRAINT "FK_e699b50ca468e75bbd36913dccb"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" DROP CONSTRAINT "FK_760034f54e598d519b5f0c4ecee"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" ADD CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill_organization" ADD CONSTRAINT "FK_61593ade5fed9445738ddbe39c4" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" ADD CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill_employee" ADD CONSTRAINT "FK_e699b50ca468e75bbd36913dccb" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "skill_employee" ADD CONSTRAINT "FK_760034f54e598d519b5f0c4ecee" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
     public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_760034f54e598d519b5f0c4ece"`);
        await queryRunner.query(`DROP INDEX "IDX_e699b50ca468e75bbd36913dcc"`);
        await queryRunner.query(`CREATE TABLE "temporary_skill_employee" ("skillId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("skillId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_skill_employee"("skillId", "employeeId") SELECT "skillId", "employeeId" FROM "skill_employee"`);
        await queryRunner.query(`DROP TABLE "skill_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_skill_employee" RENAME TO "skill_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_760034f54e598d519b5f0c4ece" ON "skill_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e699b50ca468e75bbd36913dcc" ON "skill_employee" ("skillId") `);
        await queryRunner.query(`DROP INDEX "IDX_3ed17d3e624435e9f2ad71e058"`);
        await queryRunner.query(`DROP INDEX "IDX_3bfdb894d67e6a29aa95780bb4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_employment_type_employee" ("organizationEmploymentTypeId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_3bfdb894d67e6a29aa95780bb47" FOREIGN KEY ("organizationEmploymentTypeId") REFERENCES "organization_employment_type" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationEmploymentTypeId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_employment_type_employee"("organizationEmploymentTypeId", "employeeId") SELECT "organizationEmploymentTypeId", "employeeId" FROM "organization_employment_type_employee"`);
        await queryRunner.query(`DROP TABLE "organization_employment_type_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_employment_type_employee" RENAME TO "organization_employment_type_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_3ed17d3e624435e9f2ad71e058" ON "organization_employment_type_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3bfdb894d67e6a29aa95780bb4" ON "organization_employment_type_employee" ("organizationEmploymentTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_b65cfda00c52e1fc26cc96e52c"`);
        await queryRunner.query(`DROP INDEX "IDX_61593ade5fed9445738ddbe39c"`);
        await queryRunner.query(`CREATE TABLE "temporary_skill_organization" ("skillId" varchar NOT NULL, "organizationId" varchar NOT NULL, PRIMARY KEY ("skillId", "organizationId"))`);
        await queryRunner.query(`INSERT INTO "temporary_skill_organization"("skillId", "organizationId") SELECT "skillId", "organizationId" FROM "skill_organization"`);
        await queryRunner.query(`DROP TABLE "skill_organization"`);
        await queryRunner.query(`ALTER TABLE "temporary_skill_organization" RENAME TO "skill_organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_b65cfda00c52e1fc26cc96e52c" ON "skill_organization" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_61593ade5fed9445738ddbe39c" ON "skill_organization" ("skillId") `);
        await queryRunner.query(`DROP INDEX "IDX_760034f54e598d519b5f0c4ece"`);
        await queryRunner.query(`DROP INDEX "IDX_e699b50ca468e75bbd36913dcc"`);
        await queryRunner.query(`CREATE TABLE "temporary_skill_employee" ("skillId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_760034f54e598d519b5f0c4ecee" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e699b50ca468e75bbd36913dccb" FOREIGN KEY ("skillId") REFERENCES "skill" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("skillId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_skill_employee"("skillId", "employeeId") SELECT "skillId", "employeeId" FROM "skill_employee"`);
        await queryRunner.query(`DROP TABLE "skill_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_skill_employee" RENAME TO "skill_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_760034f54e598d519b5f0c4ece" ON "skill_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e699b50ca468e75bbd36913dcc" ON "skill_employee" ("skillId") `);
        await queryRunner.query(`DROP INDEX "IDX_3ed17d3e624435e9f2ad71e058"`);
        await queryRunner.query(`DROP INDEX "IDX_3bfdb894d67e6a29aa95780bb4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_employment_type_employee" ("organizationEmploymentTypeId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_3bfdb894d67e6a29aa95780bb47" FOREIGN KEY ("organizationEmploymentTypeId") REFERENCES "organization_employment_type" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationEmploymentTypeId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_employment_type_employee"("organizationEmploymentTypeId", "employeeId") SELECT "organizationEmploymentTypeId", "employeeId" FROM "organization_employment_type_employee"`);
        await queryRunner.query(`DROP TABLE "organization_employment_type_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_employment_type_employee" RENAME TO "organization_employment_type_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_3ed17d3e624435e9f2ad71e058" ON "organization_employment_type_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3bfdb894d67e6a29aa95780bb4" ON "organization_employment_type_employee" ("organizationEmploymentTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_b65cfda00c52e1fc26cc96e52c"`);
        await queryRunner.query(`DROP INDEX "IDX_61593ade5fed9445738ddbe39c"`);
        await queryRunner.query(`CREATE TABLE "temporary_skill_organization" ("skillId" varchar NOT NULL, "organizationId" varchar NOT NULL, CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_61593ade5fed9445738ddbe39c4" FOREIGN KEY ("skillId") REFERENCES "skill" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("skillId", "organizationId"))`);
        await queryRunner.query(`INSERT INTO "temporary_skill_organization"("skillId", "organizationId") SELECT "skillId", "organizationId" FROM "skill_organization"`);
        await queryRunner.query(`DROP TABLE "skill_organization"`);
        await queryRunner.query(`ALTER TABLE "temporary_skill_organization" RENAME TO "skill_organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_b65cfda00c52e1fc26cc96e52c" ON "skill_organization" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_61593ade5fed9445738ddbe39c" ON "skill_organization" ("skillId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_61593ade5fed9445738ddbe39c"`);
        await queryRunner.query(`DROP INDEX "IDX_b65cfda00c52e1fc26cc96e52c"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" RENAME TO "temporary_skill_organization"`);
        await queryRunner.query(`CREATE TABLE "skill_organization" ("skillId" varchar NOT NULL, "organizationId" varchar NOT NULL, PRIMARY KEY ("skillId", "organizationId"))`);
        await queryRunner.query(`INSERT INTO "skill_organization"("skillId", "organizationId") SELECT "skillId", "organizationId" FROM "temporary_skill_organization"`);
        await queryRunner.query(`DROP TABLE "temporary_skill_organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_61593ade5fed9445738ddbe39c" ON "skill_organization" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b65cfda00c52e1fc26cc96e52c" ON "skill_organization" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_3bfdb894d67e6a29aa95780bb4"`);
        await queryRunner.query(`DROP INDEX "IDX_3ed17d3e624435e9f2ad71e058"`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" RENAME TO "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_employment_type_employee" ("organizationEmploymentTypeId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_3bfdb894d67e6a29aa95780bb47" FOREIGN KEY ("organizationEmploymentTypeId") REFERENCES "organization_employment_type" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationEmploymentTypeId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "organization_employment_type_employee"("organizationEmploymentTypeId", "employeeId") SELECT "organizationEmploymentTypeId", "employeeId" FROM "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_3bfdb894d67e6a29aa95780bb4" ON "organization_employment_type_employee" ("organizationEmploymentTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ed17d3e624435e9f2ad71e058" ON "organization_employment_type_employee" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_e699b50ca468e75bbd36913dcc"`);
        await queryRunner.query(`DROP INDEX "IDX_760034f54e598d519b5f0c4ece"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" RENAME TO "temporary_skill_employee"`);
        await queryRunner.query(`CREATE TABLE "skill_employee" ("skillId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("skillId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "skill_employee"("skillId", "employeeId") SELECT "skillId", "employeeId" FROM "temporary_skill_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_skill_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_e699b50ca468e75bbd36913dcc" ON "skill_employee" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_760034f54e598d519b5f0c4ece" ON "skill_employee" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_61593ade5fed9445738ddbe39c"`);
        await queryRunner.query(`DROP INDEX "IDX_b65cfda00c52e1fc26cc96e52c"`);
        await queryRunner.query(`ALTER TABLE "skill_organization" RENAME TO "temporary_skill_organization"`);
        await queryRunner.query(`CREATE TABLE "skill_organization" ("skillId" varchar NOT NULL, "organizationId" varchar NOT NULL, CONSTRAINT "FK_b65cfda00c52e1fc26cc96e52ca" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_61593ade5fed9445738ddbe39c4" FOREIGN KEY ("skillId") REFERENCES "skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("skillId", "organizationId"))`);
        await queryRunner.query(`INSERT INTO "skill_organization"("skillId", "organizationId") SELECT "skillId", "organizationId" FROM "temporary_skill_organization"`);
        await queryRunner.query(`DROP TABLE "temporary_skill_organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_61593ade5fed9445738ddbe39c" ON "skill_organization" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b65cfda00c52e1fc26cc96e52c" ON "skill_organization" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_3bfdb894d67e6a29aa95780bb4"`);
        await queryRunner.query(`DROP INDEX "IDX_3ed17d3e624435e9f2ad71e058"`);
        await queryRunner.query(`ALTER TABLE "organization_employment_type_employee" RENAME TO "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_employment_type_employee" ("organizationEmploymentTypeId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_3ed17d3e624435e9f2ad71e0583" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_3bfdb894d67e6a29aa95780bb47" FOREIGN KEY ("organizationEmploymentTypeId") REFERENCES "organization_employment_type" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationEmploymentTypeId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "organization_employment_type_employee"("organizationEmploymentTypeId", "employeeId") SELECT "organizationEmploymentTypeId", "employeeId" FROM "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_employment_type_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_3bfdb894d67e6a29aa95780bb4" ON "organization_employment_type_employee" ("organizationEmploymentTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ed17d3e624435e9f2ad71e058" ON "organization_employment_type_employee" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_e699b50ca468e75bbd36913dcc"`);
        await queryRunner.query(`DROP INDEX "IDX_760034f54e598d519b5f0c4ece"`);
        await queryRunner.query(`ALTER TABLE "skill_employee" RENAME TO "temporary_skill_employee"`);
        await queryRunner.query(`CREATE TABLE "skill_employee" ("skillId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_760034f54e598d519b5f0c4ecee" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e699b50ca468e75bbd36913dccb" FOREIGN KEY ("skillId") REFERENCES "skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("skillId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "skill_employee"("skillId", "employeeId") SELECT "skillId", "employeeId" FROM "temporary_skill_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_skill_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_e699b50ca468e75bbd36913dcc" ON "skill_employee" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_760034f54e598d519b5f0c4ece" ON "skill_employee" ("employeeId") `);
    }
}
