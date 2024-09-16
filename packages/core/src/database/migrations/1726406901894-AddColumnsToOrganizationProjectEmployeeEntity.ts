import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddColumnsToOrganizationProjectEmployeeEntity1726406901894 implements MigrationInterface {
	name = 'AddColumnsToOrganizationProjectEmployeeEntity1726406901894';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "deletedAt" TIMESTAMP`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isActive" boolean DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isArchived" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "tenantId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "organizationId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isManager" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "assignedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "roleId" uuid`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_cb8069ff5917c90adbc48139147" PRIMARY KEY ("id")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_837468421e96f22a2e12022ef0" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_e88acab853ab012582c6d0f3f6" ON "favorite" ("entityId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_1c5e006185395a6193ede3456c6"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e88acab853ab012582c6d0f3f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_837468421e96f22a2e12022ef0"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_cb8069ff5917c90adbc48139147"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "roleId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "assignedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isManager"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "organizationId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "tenantId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isArchived"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isActive"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "updatedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "createdAt"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "id"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "deletedAt"`);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
