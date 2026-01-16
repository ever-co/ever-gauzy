import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateOrganizationStrategicInitiativeTable1768568064892 implements MigrationInterface {
    name = 'CreateOrganizationStrategicInitiativeTable1768568064892';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        switch (queryRunner.connection.options.type) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                await this.sqliteUpQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresUpQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlUpQueryRunner(queryRunner);
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }

    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

        switch (queryRunner.connection.options.type) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                await this.sqliteDownQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresDownQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlDownQueryRunner(queryRunner);
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_strategic_initiative" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "title" character varying NOT NULL, "intent" text, "state" character varying NOT NULL DEFAULT 'draft', "visibilityScope" character varying NOT NULL DEFAULT 'organization', "signals" jsonb, "stewardId" uuid, CONSTRAINT "PK_5c9b922c6ef3ea031a5ce6a3e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_373d5b9de4985dcef9594cbb1d" ON "organization_strategic_initiative" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_12dc5eb57d914441d4e5ce0a9d" ON "organization_strategic_initiative" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d666b2fd258582fcdfcec5106" ON "organization_strategic_initiative" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8086ec128fa803de402b3f7140" ON "organization_strategic_initiative" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_36f130eca2a6e6dfc439339740" ON "organization_strategic_initiative" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_86462fa56f1f7c8ddf1421dcf1" ON "organization_strategic_initiative" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e818b78a0c614ace2902632fc" ON "organization_strategic_initiative" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae3bf84067ac6f5510d9513fad" ON "organization_strategic_initiative" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_48ff35a700f121a16a30d8627b" ON "organization_strategic_initiative" ("state") `);
        await queryRunner.query(`CREATE INDEX "IDX_45067e1433883ad9f44354a7ea" ON "organization_strategic_initiative" ("visibilityScope") `);
        await queryRunner.query(`CREATE INDEX "IDX_73711137bbfaa40659696deabb" ON "organization_strategic_initiative" ("stewardId") `);
        await queryRunner.query(`CREATE TABLE "organization_project_organization_strategic_initiative" ("organizationProjectId" uuid NOT NULL, "organizationStrategicInitiativeId" uuid NOT NULL, CONSTRAINT "PK_a0e5225bd18ede0b0bad3f3f61b" PRIMARY KEY ("organizationProjectId", "organizationStrategicInitiativeId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80" ON "organization_project_organization_strategic_initiative" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_39df82db57fb1d0efff351adc4" ON "organization_project_organization_strategic_initiative" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`ALTER TABLE "goal" ADD "organizationStrategicInitiativeId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_8a9c7aade035b947e6c7a76a2b" ON "goal" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_373d5b9de4985dcef9594cbb1d1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_12dc5eb57d914441d4e5ce0a9d7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_4d666b2fd258582fcdfcec51064" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_86462fa56f1f7c8ddf1421dcf17" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_2e818b78a0c614ace2902632fcd" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" ADD CONSTRAINT "FK_73711137bbfaa40659696deabbd" FOREIGN KEY ("stewardId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal" ADD CONSTRAINT "FK_8a9c7aade035b947e6c7a76a2bc" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project_organization_strategic_initiative" ADD CONSTRAINT "FK_aadcf9f5b3a05bd6c16e2bef806" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_project_organization_strategic_initiative" ADD CONSTRAINT "FK_39df82db57fb1d0efff351adc4f" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_project_organization_strategic_initiative" DROP CONSTRAINT "FK_39df82db57fb1d0efff351adc4f"`);
        await queryRunner.query(`ALTER TABLE "organization_project_organization_strategic_initiative" DROP CONSTRAINT "FK_aadcf9f5b3a05bd6c16e2bef806"`);
        await queryRunner.query(`ALTER TABLE "goal" DROP CONSTRAINT "FK_8a9c7aade035b947e6c7a76a2bc"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_73711137bbfaa40659696deabbd"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_2e818b78a0c614ace2902632fcd"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_86462fa56f1f7c8ddf1421dcf17"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_4d666b2fd258582fcdfcec51064"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_12dc5eb57d914441d4e5ce0a9d7"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" DROP CONSTRAINT "FK_373d5b9de4985dcef9594cbb1d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a9c7aade035b947e6c7a76a2b"`);
        await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "organizationStrategicInitiativeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39df82db57fb1d0efff351adc4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aadcf9f5b3a05bd6c16e2bef80"`);
        await queryRunner.query(`DROP TABLE "organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73711137bbfaa40659696deabb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_45067e1433883ad9f44354a7ea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48ff35a700f121a16a30d8627b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae3bf84067ac6f5510d9513fad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e818b78a0c614ace2902632fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_86462fa56f1f7c8ddf1421dcf1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36f130eca2a6e6dfc439339740"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8086ec128fa803de402b3f7140"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d666b2fd258582fcdfcec5106"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12dc5eb57d914441d4e5ce0a9d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_373d5b9de4985dcef9594cbb1d"`);
        await queryRunner.query(`DROP TABLE "organization_strategic_initiative"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_strategic_initiative" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "intent" text, "state" varchar NOT NULL DEFAULT ('draft'), "visibilityScope" varchar NOT NULL DEFAULT ('organization'), "signals" text, "stewardId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_373d5b9de4985dcef9594cbb1d" ON "organization_strategic_initiative" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_12dc5eb57d914441d4e5ce0a9d" ON "organization_strategic_initiative" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d666b2fd258582fcdfcec5106" ON "organization_strategic_initiative" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8086ec128fa803de402b3f7140" ON "organization_strategic_initiative" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_36f130eca2a6e6dfc439339740" ON "organization_strategic_initiative" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_86462fa56f1f7c8ddf1421dcf1" ON "organization_strategic_initiative" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e818b78a0c614ace2902632fc" ON "organization_strategic_initiative" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae3bf84067ac6f5510d9513fad" ON "organization_strategic_initiative" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_48ff35a700f121a16a30d8627b" ON "organization_strategic_initiative" ("state") `);
        await queryRunner.query(`CREATE INDEX "IDX_45067e1433883ad9f44354a7ea" ON "organization_strategic_initiative" ("visibilityScope") `);
        await queryRunner.query(`CREATE INDEX "IDX_73711137bbfaa40659696deabb" ON "organization_strategic_initiative" ("stewardId") `);
        await queryRunner.query(`CREATE TABLE "organization_project_organization_strategic_initiative" ("organizationProjectId" varchar NOT NULL, "organizationStrategicInitiativeId" varchar NOT NULL, PRIMARY KEY ("organizationProjectId", "organizationStrategicInitiativeId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80" ON "organization_project_organization_strategic_initiative" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_39df82db57fb1d0efff351adc4" ON "organization_project_organization_strategic_initiative" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`DROP INDEX "IDX_fc2492480b1c0d55ab8a6f249b"`);
        await queryRunner.query(`DROP INDEX "IDX_e3fa785e641991bb9e3e9a5553"`);
        await queryRunner.query(`DROP INDEX "IDX_4c8b4e887a994182fd6132e640"`);
        await queryRunner.query(`DROP INDEX "IDX_af0a11734e70412b742ac339c8"`);
        await queryRunner.query(`DROP INDEX "IDX_35526ff1063ab5fa2b20e71bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_ac161c1a0c0ff8e83554f097e5"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e8ae55a4db3584686cbf6afe"`);
        await queryRunner.query(`DROP INDEX "IDX_6b4758a5442713070c9a366d0e"`);
        await queryRunner.query(`DROP INDEX "IDX_72641ffde44e1a1627aa2d040f"`);
        await queryRunner.query(`DROP INDEX "IDX_4a2c00a44350a063d75be80ba9"`);
        await queryRunner.query(`DROP INDEX "IDX_ead8dd87bf3c1fc2d1209e8750"`);
        await queryRunner.query(`CREATE TABLE "temporary_goal" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar NOT NULL, "deadline" varchar NOT NULL, "level" varchar NOT NULL, "progress" integer NOT NULL, "ownerTeamId" varchar, "ownerEmployeeId" varchar, "leadId" varchar, "alignedKeyResultId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "organizationStrategicInitiativeId" varchar, CONSTRAINT "FK_fc2492480b1c0d55ab8a6f249ba" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4c8b4e887a994182fd6132e6400" FOREIGN KEY ("alignedKeyResultId") REFERENCES "key_result" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_af0a11734e70412b742ac339c88" FOREIGN KEY ("leadId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_35526ff1063ab5fa2b20e71bd66" FOREIGN KEY ("ownerEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ac161c1a0c0ff8e83554f097e5e" FOREIGN KEY ("ownerTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6e8ae55a4db3584686cbf6afe1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6b4758a5442713070c9a366d0e5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_goal"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "goal"`);
        await queryRunner.query(`DROP TABLE "goal"`);
        await queryRunner.query(`ALTER TABLE "temporary_goal" RENAME TO "goal"`);
        await queryRunner.query(`CREATE INDEX "IDX_fc2492480b1c0d55ab8a6f249b" ON "goal" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3fa785e641991bb9e3e9a5553" ON "goal" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c8b4e887a994182fd6132e640" ON "goal" ("alignedKeyResultId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af0a11734e70412b742ac339c8" ON "goal" ("leadId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35526ff1063ab5fa2b20e71bd6" ON "goal" ("ownerEmployeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac161c1a0c0ff8e83554f097e5" ON "goal" ("ownerTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e8ae55a4db3584686cbf6afe" ON "goal" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b4758a5442713070c9a366d0e" ON "goal" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_72641ffde44e1a1627aa2d040f" ON "goal" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a2c00a44350a063d75be80ba9" ON "goal" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_ead8dd87bf3c1fc2d1209e8750" ON "goal" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a9c7aade035b947e6c7a76a2b" ON "goal" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`DROP INDEX "IDX_373d5b9de4985dcef9594cbb1d"`);
        await queryRunner.query(`DROP INDEX "IDX_12dc5eb57d914441d4e5ce0a9d"`);
        await queryRunner.query(`DROP INDEX "IDX_4d666b2fd258582fcdfcec5106"`);
        await queryRunner.query(`DROP INDEX "IDX_8086ec128fa803de402b3f7140"`);
        await queryRunner.query(`DROP INDEX "IDX_36f130eca2a6e6dfc439339740"`);
        await queryRunner.query(`DROP INDEX "IDX_86462fa56f1f7c8ddf1421dcf1"`);
        await queryRunner.query(`DROP INDEX "IDX_2e818b78a0c614ace2902632fc"`);
        await queryRunner.query(`DROP INDEX "IDX_ae3bf84067ac6f5510d9513fad"`);
        await queryRunner.query(`DROP INDEX "IDX_48ff35a700f121a16a30d8627b"`);
        await queryRunner.query(`DROP INDEX "IDX_45067e1433883ad9f44354a7ea"`);
        await queryRunner.query(`DROP INDEX "IDX_73711137bbfaa40659696deabb"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_strategic_initiative" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "intent" text, "state" varchar NOT NULL DEFAULT ('draft'), "visibilityScope" varchar NOT NULL DEFAULT ('organization'), "signals" text, "stewardId" varchar, CONSTRAINT "FK_373d5b9de4985dcef9594cbb1d1" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_12dc5eb57d914441d4e5ce0a9d7" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4d666b2fd258582fcdfcec51064" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_86462fa56f1f7c8ddf1421dcf17" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2e818b78a0c614ace2902632fcd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_73711137bbfaa40659696deabbd" FOREIGN KEY ("stewardId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_strategic_initiative"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "intent", "state", "visibilityScope", "signals", "stewardId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "intent", "state", "visibilityScope", "signals", "stewardId" FROM "organization_strategic_initiative"`);
        await queryRunner.query(`DROP TABLE "organization_strategic_initiative"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_strategic_initiative" RENAME TO "organization_strategic_initiative"`);
        await queryRunner.query(`CREATE INDEX "IDX_373d5b9de4985dcef9594cbb1d" ON "organization_strategic_initiative" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_12dc5eb57d914441d4e5ce0a9d" ON "organization_strategic_initiative" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d666b2fd258582fcdfcec5106" ON "organization_strategic_initiative" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8086ec128fa803de402b3f7140" ON "organization_strategic_initiative" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_36f130eca2a6e6dfc439339740" ON "organization_strategic_initiative" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_86462fa56f1f7c8ddf1421dcf1" ON "organization_strategic_initiative" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e818b78a0c614ace2902632fc" ON "organization_strategic_initiative" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae3bf84067ac6f5510d9513fad" ON "organization_strategic_initiative" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_48ff35a700f121a16a30d8627b" ON "organization_strategic_initiative" ("state") `);
        await queryRunner.query(`CREATE INDEX "IDX_45067e1433883ad9f44354a7ea" ON "organization_strategic_initiative" ("visibilityScope") `);
        await queryRunner.query(`CREATE INDEX "IDX_73711137bbfaa40659696deabb" ON "organization_strategic_initiative" ("stewardId") `);
        await queryRunner.query(`DROP INDEX "IDX_fc2492480b1c0d55ab8a6f249b"`);
        await queryRunner.query(`DROP INDEX "IDX_e3fa785e641991bb9e3e9a5553"`);
        await queryRunner.query(`DROP INDEX "IDX_4c8b4e887a994182fd6132e640"`);
        await queryRunner.query(`DROP INDEX "IDX_af0a11734e70412b742ac339c8"`);
        await queryRunner.query(`DROP INDEX "IDX_35526ff1063ab5fa2b20e71bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_ac161c1a0c0ff8e83554f097e5"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e8ae55a4db3584686cbf6afe"`);
        await queryRunner.query(`DROP INDEX "IDX_6b4758a5442713070c9a366d0e"`);
        await queryRunner.query(`DROP INDEX "IDX_72641ffde44e1a1627aa2d040f"`);
        await queryRunner.query(`DROP INDEX "IDX_4a2c00a44350a063d75be80ba9"`);
        await queryRunner.query(`DROP INDEX "IDX_ead8dd87bf3c1fc2d1209e8750"`);
        await queryRunner.query(`DROP INDEX "IDX_8a9c7aade035b947e6c7a76a2b"`);
        await queryRunner.query(`CREATE TABLE "temporary_goal" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar NOT NULL, "deadline" varchar NOT NULL, "level" varchar NOT NULL, "progress" integer NOT NULL, "ownerTeamId" varchar, "ownerEmployeeId" varchar, "leadId" varchar, "alignedKeyResultId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "organizationStrategicInitiativeId" varchar, CONSTRAINT "FK_fc2492480b1c0d55ab8a6f249ba" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4c8b4e887a994182fd6132e6400" FOREIGN KEY ("alignedKeyResultId") REFERENCES "key_result" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_af0a11734e70412b742ac339c88" FOREIGN KEY ("leadId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_35526ff1063ab5fa2b20e71bd66" FOREIGN KEY ("ownerEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ac161c1a0c0ff8e83554f097e5e" FOREIGN KEY ("ownerTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6e8ae55a4db3584686cbf6afe1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6b4758a5442713070c9a366d0e5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8a9c7aade035b947e6c7a76a2bc" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_goal"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "organizationStrategicInitiativeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "organizationStrategicInitiativeId" FROM "goal"`);
        await queryRunner.query(`DROP TABLE "goal"`);
        await queryRunner.query(`ALTER TABLE "temporary_goal" RENAME TO "goal"`);
        await queryRunner.query(`CREATE INDEX "IDX_fc2492480b1c0d55ab8a6f249b" ON "goal" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3fa785e641991bb9e3e9a5553" ON "goal" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c8b4e887a994182fd6132e640" ON "goal" ("alignedKeyResultId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af0a11734e70412b742ac339c8" ON "goal" ("leadId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35526ff1063ab5fa2b20e71bd6" ON "goal" ("ownerEmployeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac161c1a0c0ff8e83554f097e5" ON "goal" ("ownerTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e8ae55a4db3584686cbf6afe" ON "goal" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b4758a5442713070c9a366d0e" ON "goal" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_72641ffde44e1a1627aa2d040f" ON "goal" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a2c00a44350a063d75be80ba9" ON "goal" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_ead8dd87bf3c1fc2d1209e8750" ON "goal" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a9c7aade035b947e6c7a76a2b" ON "goal" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`DROP INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80"`);
        await queryRunner.query(`DROP INDEX "IDX_39df82db57fb1d0efff351adc4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project_organization_strategic_initiative" ("organizationProjectId" varchar NOT NULL, "organizationStrategicInitiativeId" varchar NOT NULL, CONSTRAINT "FK_aadcf9f5b3a05bd6c16e2bef806" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_39df82db57fb1d0efff351adc4f" FOREIGN KEY ("organizationStrategicInitiativeId") REFERENCES "organization_strategic_initiative" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectId", "organizationStrategicInitiativeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project_organization_strategic_initiative"("organizationProjectId", "organizationStrategicInitiativeId") SELECT "organizationProjectId", "organizationStrategicInitiativeId" FROM "organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`DROP TABLE "organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project_organization_strategic_initiative" RENAME TO "organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`CREATE INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80" ON "organization_project_organization_strategic_initiative" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_39df82db57fb1d0efff351adc4" ON "organization_project_organization_strategic_initiative" ("organizationStrategicInitiativeId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_39df82db57fb1d0efff351adc4"`);
        await queryRunner.query(`DROP INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80"`);
        await queryRunner.query(`ALTER TABLE "organization_project_organization_strategic_initiative" RENAME TO "temporary_organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`CREATE TABLE "organization_project_organization_strategic_initiative" ("organizationProjectId" varchar NOT NULL, "organizationStrategicInitiativeId" varchar NOT NULL, PRIMARY KEY ("organizationProjectId", "organizationStrategicInitiativeId"))`);
        await queryRunner.query(`INSERT INTO "organization_project_organization_strategic_initiative"("organizationProjectId", "organizationStrategicInitiativeId") SELECT "organizationProjectId", "organizationStrategicInitiativeId" FROM "temporary_organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`CREATE INDEX "IDX_39df82db57fb1d0efff351adc4" ON "organization_project_organization_strategic_initiative" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80" ON "organization_project_organization_strategic_initiative" ("organizationProjectId") `);
        await queryRunner.query(`DROP INDEX "IDX_8a9c7aade035b947e6c7a76a2b"`);
        await queryRunner.query(`DROP INDEX "IDX_ead8dd87bf3c1fc2d1209e8750"`);
        await queryRunner.query(`DROP INDEX "IDX_4a2c00a44350a063d75be80ba9"`);
        await queryRunner.query(`DROP INDEX "IDX_72641ffde44e1a1627aa2d040f"`);
        await queryRunner.query(`DROP INDEX "IDX_6b4758a5442713070c9a366d0e"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e8ae55a4db3584686cbf6afe"`);
        await queryRunner.query(`DROP INDEX "IDX_ac161c1a0c0ff8e83554f097e5"`);
        await queryRunner.query(`DROP INDEX "IDX_35526ff1063ab5fa2b20e71bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_af0a11734e70412b742ac339c8"`);
        await queryRunner.query(`DROP INDEX "IDX_4c8b4e887a994182fd6132e640"`);
        await queryRunner.query(`DROP INDEX "IDX_e3fa785e641991bb9e3e9a5553"`);
        await queryRunner.query(`DROP INDEX "IDX_fc2492480b1c0d55ab8a6f249b"`);
        await queryRunner.query(`ALTER TABLE "goal" RENAME TO "temporary_goal"`);
        await queryRunner.query(`CREATE TABLE "goal" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar NOT NULL, "deadline" varchar NOT NULL, "level" varchar NOT NULL, "progress" integer NOT NULL, "ownerTeamId" varchar, "ownerEmployeeId" varchar, "leadId" varchar, "alignedKeyResultId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "organizationStrategicInitiativeId" varchar, CONSTRAINT "FK_fc2492480b1c0d55ab8a6f249ba" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4c8b4e887a994182fd6132e6400" FOREIGN KEY ("alignedKeyResultId") REFERENCES "key_result" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_af0a11734e70412b742ac339c88" FOREIGN KEY ("leadId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_35526ff1063ab5fa2b20e71bd66" FOREIGN KEY ("ownerEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ac161c1a0c0ff8e83554f097e5e" FOREIGN KEY ("ownerTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6e8ae55a4db3584686cbf6afe1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6b4758a5442713070c9a366d0e5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "goal"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "organizationStrategicInitiativeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "organizationStrategicInitiativeId" FROM "temporary_goal"`);
        await queryRunner.query(`DROP TABLE "temporary_goal"`);
        await queryRunner.query(`CREATE INDEX "IDX_8a9c7aade035b947e6c7a76a2b" ON "goal" ("organizationStrategicInitiativeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ead8dd87bf3c1fc2d1209e8750" ON "goal" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a2c00a44350a063d75be80ba9" ON "goal" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_72641ffde44e1a1627aa2d040f" ON "goal" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b4758a5442713070c9a366d0e" ON "goal" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e8ae55a4db3584686cbf6afe" ON "goal" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac161c1a0c0ff8e83554f097e5" ON "goal" ("ownerTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35526ff1063ab5fa2b20e71bd6" ON "goal" ("ownerEmployeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af0a11734e70412b742ac339c8" ON "goal" ("leadId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c8b4e887a994182fd6132e640" ON "goal" ("alignedKeyResultId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3fa785e641991bb9e3e9a5553" ON "goal" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc2492480b1c0d55ab8a6f249b" ON "goal" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_73711137bbfaa40659696deabb"`);
        await queryRunner.query(`DROP INDEX "IDX_45067e1433883ad9f44354a7ea"`);
        await queryRunner.query(`DROP INDEX "IDX_48ff35a700f121a16a30d8627b"`);
        await queryRunner.query(`DROP INDEX "IDX_ae3bf84067ac6f5510d9513fad"`);
        await queryRunner.query(`DROP INDEX "IDX_2e818b78a0c614ace2902632fc"`);
        await queryRunner.query(`DROP INDEX "IDX_86462fa56f1f7c8ddf1421dcf1"`);
        await queryRunner.query(`DROP INDEX "IDX_36f130eca2a6e6dfc439339740"`);
        await queryRunner.query(`DROP INDEX "IDX_8086ec128fa803de402b3f7140"`);
        await queryRunner.query(`DROP INDEX "IDX_4d666b2fd258582fcdfcec5106"`);
        await queryRunner.query(`DROP INDEX "IDX_12dc5eb57d914441d4e5ce0a9d"`);
        await queryRunner.query(`DROP INDEX "IDX_373d5b9de4985dcef9594cbb1d"`);
        await queryRunner.query(`ALTER TABLE "organization_strategic_initiative" RENAME TO "temporary_organization_strategic_initiative"`);
        await queryRunner.query(`CREATE TABLE "organization_strategic_initiative" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "intent" text, "state" varchar NOT NULL DEFAULT ('draft'), "visibilityScope" varchar NOT NULL DEFAULT ('organization'), "signals" text, "stewardId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_strategic_initiative"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "intent", "state", "visibilityScope", "signals", "stewardId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "title", "intent", "state", "visibilityScope", "signals", "stewardId" FROM "temporary_organization_strategic_initiative"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_strategic_initiative"`);
        await queryRunner.query(`CREATE INDEX "IDX_73711137bbfaa40659696deabb" ON "organization_strategic_initiative" ("stewardId") `);
        await queryRunner.query(`CREATE INDEX "IDX_45067e1433883ad9f44354a7ea" ON "organization_strategic_initiative" ("visibilityScope") `);
        await queryRunner.query(`CREATE INDEX "IDX_48ff35a700f121a16a30d8627b" ON "organization_strategic_initiative" ("state") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae3bf84067ac6f5510d9513fad" ON "organization_strategic_initiative" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e818b78a0c614ace2902632fc" ON "organization_strategic_initiative" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86462fa56f1f7c8ddf1421dcf1" ON "organization_strategic_initiative" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_36f130eca2a6e6dfc439339740" ON "organization_strategic_initiative" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8086ec128fa803de402b3f7140" ON "organization_strategic_initiative" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d666b2fd258582fcdfcec5106" ON "organization_strategic_initiative" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_12dc5eb57d914441d4e5ce0a9d" ON "organization_strategic_initiative" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_373d5b9de4985dcef9594cbb1d" ON "organization_strategic_initiative" ("createdByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_8a9c7aade035b947e6c7a76a2b"`);
        await queryRunner.query(`DROP INDEX "IDX_ead8dd87bf3c1fc2d1209e8750"`);
        await queryRunner.query(`DROP INDEX "IDX_4a2c00a44350a063d75be80ba9"`);
        await queryRunner.query(`DROP INDEX "IDX_72641ffde44e1a1627aa2d040f"`);
        await queryRunner.query(`DROP INDEX "IDX_6b4758a5442713070c9a366d0e"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e8ae55a4db3584686cbf6afe"`);
        await queryRunner.query(`DROP INDEX "IDX_ac161c1a0c0ff8e83554f097e5"`);
        await queryRunner.query(`DROP INDEX "IDX_35526ff1063ab5fa2b20e71bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_af0a11734e70412b742ac339c8"`);
        await queryRunner.query(`DROP INDEX "IDX_4c8b4e887a994182fd6132e640"`);
        await queryRunner.query(`DROP INDEX "IDX_e3fa785e641991bb9e3e9a5553"`);
        await queryRunner.query(`DROP INDEX "IDX_fc2492480b1c0d55ab8a6f249b"`);
        await queryRunner.query(`ALTER TABLE "goal" RENAME TO "temporary_goal"`);
        await queryRunner.query(`CREATE TABLE "goal" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar NOT NULL, "deadline" varchar NOT NULL, "level" varchar NOT NULL, "progress" integer NOT NULL, "ownerTeamId" varchar, "ownerEmployeeId" varchar, "leadId" varchar, "alignedKeyResultId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_fc2492480b1c0d55ab8a6f249ba" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4c8b4e887a994182fd6132e6400" FOREIGN KEY ("alignedKeyResultId") REFERENCES "key_result" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_af0a11734e70412b742ac339c88" FOREIGN KEY ("leadId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_35526ff1063ab5fa2b20e71bd66" FOREIGN KEY ("ownerEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ac161c1a0c0ff8e83554f097e5e" FOREIGN KEY ("ownerTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6e8ae55a4db3584686cbf6afe1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6b4758a5442713070c9a366d0e5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "goal"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "deadline", "level", "progress", "ownerTeamId", "ownerEmployeeId", "leadId", "alignedKeyResultId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_goal"`);
        await queryRunner.query(`DROP TABLE "temporary_goal"`);
        await queryRunner.query(`CREATE INDEX "IDX_ead8dd87bf3c1fc2d1209e8750" ON "goal" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a2c00a44350a063d75be80ba9" ON "goal" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_72641ffde44e1a1627aa2d040f" ON "goal" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b4758a5442713070c9a366d0e" ON "goal" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e8ae55a4db3584686cbf6afe" ON "goal" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac161c1a0c0ff8e83554f097e5" ON "goal" ("ownerTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35526ff1063ab5fa2b20e71bd6" ON "goal" ("ownerEmployeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af0a11734e70412b742ac339c8" ON "goal" ("leadId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c8b4e887a994182fd6132e640" ON "goal" ("alignedKeyResultId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3fa785e641991bb9e3e9a5553" ON "goal" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc2492480b1c0d55ab8a6f249b" ON "goal" ("deletedByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_39df82db57fb1d0efff351adc4"`);
        await queryRunner.query(`DROP INDEX "IDX_aadcf9f5b3a05bd6c16e2bef80"`);
        await queryRunner.query(`DROP TABLE "organization_project_organization_strategic_initiative"`);
        await queryRunner.query(`DROP INDEX "IDX_73711137bbfaa40659696deabb"`);
        await queryRunner.query(`DROP INDEX "IDX_45067e1433883ad9f44354a7ea"`);
        await queryRunner.query(`DROP INDEX "IDX_48ff35a700f121a16a30d8627b"`);
        await queryRunner.query(`DROP INDEX "IDX_ae3bf84067ac6f5510d9513fad"`);
        await queryRunner.query(`DROP INDEX "IDX_2e818b78a0c614ace2902632fc"`);
        await queryRunner.query(`DROP INDEX "IDX_86462fa56f1f7c8ddf1421dcf1"`);
        await queryRunner.query(`DROP INDEX "IDX_36f130eca2a6e6dfc439339740"`);
        await queryRunner.query(`DROP INDEX "IDX_8086ec128fa803de402b3f7140"`);
        await queryRunner.query(`DROP INDEX "IDX_4d666b2fd258582fcdfcec5106"`);
        await queryRunner.query(`DROP INDEX "IDX_12dc5eb57d914441d4e5ce0a9d"`);
        await queryRunner.query(`DROP INDEX "IDX_373d5b9de4985dcef9594cbb1d"`);
        await queryRunner.query(`DROP TABLE "organization_strategic_initiative"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`organization_strategic_initiative\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`intent\` text NULL, \`state\` varchar(255) NOT NULL DEFAULT 'draft', \`visibilityScope\` varchar(255) NOT NULL DEFAULT 'organization', \`signals\` json NULL, \`stewardId\` varchar(255) NULL, INDEX \`IDX_373d5b9de4985dcef9594cbb1d\` (\`createdByUserId\`), INDEX \`IDX_12dc5eb57d914441d4e5ce0a9d\` (\`updatedByUserId\`), INDEX \`IDX_4d666b2fd258582fcdfcec5106\` (\`deletedByUserId\`), INDEX \`IDX_8086ec128fa803de402b3f7140\` (\`isActive\`), INDEX \`IDX_36f130eca2a6e6dfc439339740\` (\`isArchived\`), INDEX \`IDX_86462fa56f1f7c8ddf1421dcf1\` (\`tenantId\`), INDEX \`IDX_2e818b78a0c614ace2902632fc\` (\`organizationId\`), INDEX \`IDX_ae3bf84067ac6f5510d9513fad\` (\`title\`), INDEX \`IDX_48ff35a700f121a16a30d8627b\` (\`state\`), INDEX \`IDX_45067e1433883ad9f44354a7ea\` (\`visibilityScope\`), INDEX \`IDX_73711137bbfaa40659696deabb\` (\`stewardId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`organization_project_organization_strategic_initiative\` (\`organizationProjectId\` varchar(36) NOT NULL, \`organizationStrategicInitiativeId\` varchar(36) NOT NULL, INDEX \`IDX_aadcf9f5b3a05bd6c16e2bef80\` (\`organizationProjectId\`), INDEX \`IDX_39df82db57fb1d0efff351adc4\` (\`organizationStrategicInitiativeId\`), PRIMARY KEY (\`organizationProjectId\`, \`organizationStrategicInitiativeId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`goal\` ADD \`organizationStrategicInitiativeId\` varchar(255) NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_8a9c7aade035b947e6c7a76a2b\` ON \`goal\` (\`organizationStrategicInitiativeId\`)`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_373d5b9de4985dcef9594cbb1d1\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_12dc5eb57d914441d4e5ce0a9d7\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_4d666b2fd258582fcdfcec51064\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_86462fa56f1f7c8ddf1421dcf17\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_2e818b78a0c614ace2902632fcd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` ADD CONSTRAINT \`FK_73711137bbfaa40659696deabbd\` FOREIGN KEY (\`stewardId\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_8a9c7aade035b947e6c7a76a2bc\` FOREIGN KEY (\`organizationStrategicInitiativeId\`) REFERENCES \`organization_strategic_initiative\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`organization_project_organization_strategic_initiative\` ADD CONSTRAINT \`FK_aadcf9f5b3a05bd6c16e2bef806\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`organization_project_organization_strategic_initiative\` ADD CONSTRAINT \`FK_39df82db57fb1d0efff351adc4f\` FOREIGN KEY (\`organizationStrategicInitiativeId\`) REFERENCES \`organization_strategic_initiative\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`organization_project_organization_strategic_initiative\` DROP FOREIGN KEY \`FK_39df82db57fb1d0efff351adc4f\``);
        await queryRunner.query(`ALTER TABLE \`organization_project_organization_strategic_initiative\` DROP FOREIGN KEY \`FK_aadcf9f5b3a05bd6c16e2bef806\``);
        await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_8a9c7aade035b947e6c7a76a2bc\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_73711137bbfaa40659696deabbd\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_2e818b78a0c614ace2902632fcd\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_86462fa56f1f7c8ddf1421dcf17\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_4d666b2fd258582fcdfcec51064\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_12dc5eb57d914441d4e5ce0a9d7\``);
        await queryRunner.query(`ALTER TABLE \`organization_strategic_initiative\` DROP FOREIGN KEY \`FK_373d5b9de4985dcef9594cbb1d1\``);
        await queryRunner.query(`DROP INDEX \`IDX_8a9c7aade035b947e6c7a76a2b\` ON \`goal\``);
        await queryRunner.query(`ALTER TABLE \`goal\` DROP COLUMN \`organizationStrategicInitiativeId\``);
        await queryRunner.query(`DROP INDEX \`IDX_39df82db57fb1d0efff351adc4\` ON \`organization_project_organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_aadcf9f5b3a05bd6c16e2bef80\` ON \`organization_project_organization_strategic_initiative\``);
        await queryRunner.query(`DROP TABLE \`organization_project_organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_73711137bbfaa40659696deabb\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_45067e1433883ad9f44354a7ea\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_48ff35a700f121a16a30d8627b\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_ae3bf84067ac6f5510d9513fad\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_2e818b78a0c614ace2902632fc\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_86462fa56f1f7c8ddf1421dcf1\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_36f130eca2a6e6dfc439339740\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_8086ec128fa803de402b3f7140\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_4d666b2fd258582fcdfcec5106\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_12dc5eb57d914441d4e5ce0a9d\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP INDEX \`IDX_373d5b9de4985dcef9594cbb1d\` ON \`organization_strategic_initiative\``);
        await queryRunner.query(`DROP TABLE \`organization_strategic_initiative\``);
    }
}
