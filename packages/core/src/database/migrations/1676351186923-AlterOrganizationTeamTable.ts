import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";

export class AlterOrganizationTeamTable1676351186923 implements MigrationInterface {

    name = 'AlterOrganizationTeamTable1676351186923';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        await queryRunner.query(`ALTER TABLE "organization_team" ADD "public" boolean DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "organization_team" ADD "profile_link" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e22ab0f1236b1a07785b641727"`);
        await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "profile_link"`);
        await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "public"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (1), "profile_link" varchar, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById" FROM "organization_team"`);
        await queryRunner.query(`DROP TABLE "organization_team"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
        await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);
        await queryRunner.query(`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById" FROM "temporary_organization_team"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
    }
}
