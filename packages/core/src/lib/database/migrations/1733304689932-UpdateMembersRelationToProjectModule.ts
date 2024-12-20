import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class UpdateMembersRelationToProjectModule1733304689932 implements MigrationInterface {

    name = 'UpdateMembersRelationToProjectModule1733304689932';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
        await queryRunner.query(`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6b6555e5fc6c5120110a0195c"`);
        await queryRunner.query(`CREATE TABLE "organization_project_module_employee" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "isManager" boolean DEFAULT false, "assignedAt" TIMESTAMP, "organizationProjectModuleId" uuid NOT NULL, "employeeId" uuid NOT NULL, "roleId" uuid, CONSTRAINT "PK_31c545c357a16282a2310027a05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_84e91db708746a20040843c887" ON "organization_project_module_employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5851128af6de9c905f0e2be1e6" ON "organization_project_module_employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_0b50ed382a8698a973b6201895" ON "organization_project_module_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0f24a425e294a86c977ccafed" ON "organization_project_module_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ee53d5870dcd9668536d617f0" ON "organization_project_module_employee" ("isManager") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa8fbbaa9d358aff5afb6492d3" ON "organization_project_module_employee" ("assignedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c" ON "organization_project_module_employee" ("organizationProjectModuleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_230366f71696f7752afac3f53c" ON "organization_project_module_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f4b71530d53181987bea86a93" ON "organization_project_module_employee" ("roleId") `);
        await queryRunner.query(`ALTER TABLE "organization_project_module" DROP COLUMN "managerId"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_0b50ed382a8698a973b6201895a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_c0f24a425e294a86c977ccafed6" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_5c6124c57cf06b62e6c5d4ae2c6" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_230366f71696f7752afac3f53cd" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_5f4b71530d53181987bea86a938" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_5f4b71530d53181987bea86a938"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_230366f71696f7752afac3f53cd"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_5c6124c57cf06b62e6c5d4ae2c6"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_c0f24a425e294a86c977ccafed6"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_0b50ed382a8698a973b6201895a"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module" ADD "managerId" uuid`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f4b71530d53181987bea86a93"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_230366f71696f7752afac3f53c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c6124c57cf06b62e6c5d4ae2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa8fbbaa9d358aff5afb6492d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ee53d5870dcd9668536d617f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0f24a425e294a86c977ccafed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b50ed382a8698a973b6201895"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5851128af6de9c905f0e2be1e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84e91db708746a20040843c887"`);
        await queryRunner.query(`DROP TABLE "organization_project_module_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `);
        await queryRunner.query(`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
        await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
        await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
        await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
        await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
        await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
        await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar, "archivedAt" datetime, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId", "archivedAt" FROM "organization_project_module"`);
        await queryRunner.query(`DROP TABLE "organization_project_module"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`);
        await queryRunner.query(`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `);
        await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
        await queryRunner.query(`CREATE TABLE "organization_project_module_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_84e91db708746a20040843c887" ON "organization_project_module_employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5851128af6de9c905f0e2be1e6" ON "organization_project_module_employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_0b50ed382a8698a973b6201895" ON "organization_project_module_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0f24a425e294a86c977ccafed" ON "organization_project_module_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ee53d5870dcd9668536d617f0" ON "organization_project_module_employee" ("isManager") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa8fbbaa9d358aff5afb6492d3" ON "organization_project_module_employee" ("assignedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c" ON "organization_project_module_employee" ("organizationProjectModuleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_230366f71696f7752afac3f53c" ON "organization_project_module_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f4b71530d53181987bea86a93" ON "organization_project_module_employee" ("roleId") `);
        await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
        await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
        await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
        await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
        await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
        await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "archivedAt" datetime, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt" FROM "organization_project_module"`);
        await queryRunner.query(`DROP TABLE "organization_project_module"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`);
        await queryRunner.query(`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `);
        await queryRunner.query(`DROP INDEX "IDX_84e91db708746a20040843c887"`);
        await queryRunner.query(`DROP INDEX "IDX_5851128af6de9c905f0e2be1e6"`);
        await queryRunner.query(`DROP INDEX "IDX_0b50ed382a8698a973b6201895"`);
        await queryRunner.query(`DROP INDEX "IDX_c0f24a425e294a86c977ccafed"`);
        await queryRunner.query(`DROP INDEX "IDX_4ee53d5870dcd9668536d617f0"`);
        await queryRunner.query(`DROP INDEX "IDX_fa8fbbaa9d358aff5afb6492d3"`);
        await queryRunner.query(`DROP INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c"`);
        await queryRunner.query(`DROP INDEX "IDX_230366f71696f7752afac3f53c"`);
        await queryRunner.query(`DROP INDEX "IDX_5f4b71530d53181987bea86a93"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project_module_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, CONSTRAINT "FK_0b50ed382a8698a973b6201895a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c0f24a425e294a86c977ccafed6" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5c6124c57cf06b62e6c5d4ae2c6" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_230366f71696f7752afac3f53cd" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f4b71530d53181987bea86a938" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project_module_employee"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationProjectModuleId", "employeeId", "roleId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationProjectModuleId", "employeeId", "roleId" FROM "organization_project_module_employee"`);
        await queryRunner.query(`DROP TABLE "organization_project_module_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project_module_employee" RENAME TO "organization_project_module_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_84e91db708746a20040843c887" ON "organization_project_module_employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5851128af6de9c905f0e2be1e6" ON "organization_project_module_employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_0b50ed382a8698a973b6201895" ON "organization_project_module_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0f24a425e294a86c977ccafed" ON "organization_project_module_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ee53d5870dcd9668536d617f0" ON "organization_project_module_employee" ("isManager") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa8fbbaa9d358aff5afb6492d3" ON "organization_project_module_employee" ("assignedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c" ON "organization_project_module_employee" ("organizationProjectModuleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_230366f71696f7752afac3f53c" ON "organization_project_module_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f4b71530d53181987bea86a93" ON "organization_project_module_employee" ("roleId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5f4b71530d53181987bea86a93"`);
        await queryRunner.query(`DROP INDEX "IDX_230366f71696f7752afac3f53c"`);
        await queryRunner.query(`DROP INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c"`);
        await queryRunner.query(`DROP INDEX "IDX_fa8fbbaa9d358aff5afb6492d3"`);
        await queryRunner.query(`DROP INDEX "IDX_4ee53d5870dcd9668536d617f0"`);
        await queryRunner.query(`DROP INDEX "IDX_c0f24a425e294a86c977ccafed"`);
        await queryRunner.query(`DROP INDEX "IDX_0b50ed382a8698a973b6201895"`);
        await queryRunner.query(`DROP INDEX "IDX_5851128af6de9c905f0e2be1e6"`);
        await queryRunner.query(`DROP INDEX "IDX_84e91db708746a20040843c887"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module_employee" RENAME TO "temporary_organization_project_module_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_project_module_employee" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "isManager" boolean DEFAULT (0), "assignedAt" datetime, "organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_project_module_employee"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationProjectModuleId", "employeeId", "roleId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "isManager", "assignedAt", "organizationProjectModuleId", "employeeId", "roleId" FROM "temporary_organization_project_module_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project_module_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_5f4b71530d53181987bea86a93" ON "organization_project_module_employee" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_230366f71696f7752afac3f53c" ON "organization_project_module_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c" ON "organization_project_module_employee" ("organizationProjectModuleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa8fbbaa9d358aff5afb6492d3" ON "organization_project_module_employee" ("assignedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ee53d5870dcd9668536d617f0" ON "organization_project_module_employee" ("isManager") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0f24a425e294a86c977ccafed" ON "organization_project_module_employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0b50ed382a8698a973b6201895" ON "organization_project_module_employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5851128af6de9c905f0e2be1e6" ON "organization_project_module_employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_84e91db708746a20040843c887" ON "organization_project_module_employee" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
        await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
        await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
        await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
        await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
        await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`);
        await queryRunner.query(`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar, "archivedAt" datetime, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "archivedAt" FROM "temporary_organization_project_module"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
        await queryRunner.query(`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_5f4b71530d53181987bea86a93"`);
        await queryRunner.query(`DROP INDEX "IDX_230366f71696f7752afac3f53c"`);
        await queryRunner.query(`DROP INDEX "IDX_5c6124c57cf06b62e6c5d4ae2c"`);
        await queryRunner.query(`DROP INDEX "IDX_fa8fbbaa9d358aff5afb6492d3"`);
        await queryRunner.query(`DROP INDEX "IDX_4ee53d5870dcd9668536d617f0"`);
        await queryRunner.query(`DROP INDEX "IDX_c0f24a425e294a86c977ccafed"`);
        await queryRunner.query(`DROP INDEX "IDX_0b50ed382a8698a973b6201895"`);
        await queryRunner.query(`DROP INDEX "IDX_5851128af6de9c905f0e2be1e6"`);
        await queryRunner.query(`DROP INDEX "IDX_84e91db708746a20040843c887"`);
        await queryRunner.query(`DROP TABLE "organization_project_module_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `);
        await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
        await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
        await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
        await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
        await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
        await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
        await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
        await queryRunner.query(`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`);
        await queryRunner.query(`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar, "archivedAt" datetime, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd" FOREIGN KEY ("managerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId", "archivedAt") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId", "archivedAt" FROM "temporary_organization_project_module"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
        await queryRunner.query(`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_e6b6555e5fc6c5120110a0195cd\``);
		await queryRunner.query(`DROP INDEX \`IDX_e6b6555e5fc6c5120110a0195c\` ON \`organization_project_module\``);
		await queryRunner.query(`CREATE TABLE \`organization_project_module_employee\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isManager\` tinyint NULL DEFAULT 0, \`assignedAt\` datetime NULL, \`organizationProjectModuleId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`roleId\` varchar(255) NULL, INDEX \`IDX_84e91db708746a20040843c887\` (\`isActive\`), INDEX \`IDX_5851128af6de9c905f0e2be1e6\` (\`isArchived\`), INDEX \`IDX_0b50ed382a8698a973b6201895\` (\`tenantId\`), INDEX \`IDX_c0f24a425e294a86c977ccafed\` (\`organizationId\`), INDEX \`IDX_4ee53d5870dcd9668536d617f0\` (\`isManager\`), INDEX \`IDX_fa8fbbaa9d358aff5afb6492d3\` (\`assignedAt\`), INDEX \`IDX_5c6124c57cf06b62e6c5d4ae2c\` (\`organizationProjectModuleId\`), INDEX \`IDX_230366f71696f7752afac3f53c\` (\`employeeId\`), INDEX \`IDX_5f4b71530d53181987bea86a93\` (\`roleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module\` DROP COLUMN \`managerId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` ADD CONSTRAINT \`FK_0b50ed382a8698a973b6201895a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` ADD CONSTRAINT \`FK_c0f24a425e294a86c977ccafed6\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` ADD CONSTRAINT \`FK_5c6124c57cf06b62e6c5d4ae2c6\` FOREIGN KEY (\`organizationProjectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` ADD CONSTRAINT \`FK_230366f71696f7752afac3f53cd\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` ADD CONSTRAINT \`FK_5f4b71530d53181987bea86a938\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` DROP FOREIGN KEY \`FK_5f4b71530d53181987bea86a938\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` DROP FOREIGN KEY \`FK_230366f71696f7752afac3f53cd\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` DROP FOREIGN KEY \`FK_5c6124c57cf06b62e6c5d4ae2c6\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` DROP FOREIGN KEY \`FK_c0f24a425e294a86c977ccafed6\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module_employee\` DROP FOREIGN KEY \`FK_0b50ed382a8698a973b6201895a\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module\` ADD \`managerId\` varchar(255) NULL`);
		await queryRunner.query(`DROP INDEX \`IDX_5f4b71530d53181987bea86a93\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_230366f71696f7752afac3f53c\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_5c6124c57cf06b62e6c5d4ae2c\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa8fbbaa9d358aff5afb6492d3\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_4ee53d5870dcd9668536d617f0\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_c0f24a425e294a86c977ccafed\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_0b50ed382a8698a973b6201895\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_5851128af6de9c905f0e2be1e6\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_84e91db708746a20040843c887\` ON \`organization_project_module_employee\``);
		await queryRunner.query(`DROP TABLE \`organization_project_module_employee\``);
		await queryRunner.query(`CREATE INDEX \`IDX_e6b6555e5fc6c5120110a0195c\` ON \`organization_project_module\` (\`managerId\`)`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_e6b6555e5fc6c5120110a0195cd\` FOREIGN KEY (\`managerId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
