import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationProjectAndProjectEmployeeAddFields1725864010006 implements MigrationInterface {
	name = 'AlterOrganizationProjectAndProjectEmployeeAddFields1725864010006';

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
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "status" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "icon" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "archiveTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "closeTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "defaultAssigneeId" uuid`);
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
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "tenantId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "organizationId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "roleId" uuid`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);
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
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_cb8069ff5917c90adbc48139147"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("id", "employeeId")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "id", "organizationProjectId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
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
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_489012234f53089d4b508f4aa12"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3d1102a8aa6442cdfce5d57c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16c34de330ae8d59d9b31cce14"`);
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
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "roleId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "organizationId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "tenantId"`);
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
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "defaultAssigneeId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "closeTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "archiveTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "icon"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "status"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
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
