import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterPaymentEntityTable1740049728884 implements MigrationInterface {
	name = 'AlterPaymentEntityTable1740049728884';

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
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_3f13c738eff604a85700746ec7d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3f13c738eff604a85700746ec7"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME COLUMN "recordedById" TO "createdByUserId"`);
		await queryRunner.query(`CREATE INDEX "IDX_6337f8d52d8eea1055ca8e3570" ON "payment" ("createdByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "payment"
			ADD CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6337f8d52d8eea1055ca8e3570"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME COLUMN "createdByUserId" TO "recordedById"`);
		await queryRunner.query(`CREATE INDEX "IDX_3f13c738eff604a85700746ec7" ON "payment" ("recordedById") `);
		await queryRunner.query(
			`ALTER TABLE "payment"
			ADD CONSTRAINT "FK_3f13c738eff604a85700746ec7d" FOREIGN KEY ("recordedById") REFERENCES "user"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_3f13c738eff604a85700746ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "recordedById" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "payment"`
		);
		await queryRunner.query(`DROP TABLE "payment"`);
		await queryRunner.query(`ALTER TABLE "temporary_payment" RENAME TO "payment"`);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3f13c738eff604a85700746ec7" ON "payment" ("recordedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_3f13c738eff604a85700746ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "createdByUserId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "payment"`
		);
		await queryRunner.query(`DROP TABLE "payment"`);
		await queryRunner.query(`ALTER TABLE "temporary_payment" RENAME TO "payment"`);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6337f8d52d8eea1055ca8e3570" ON "payment" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(`DROP INDEX "IDX_6337f8d52d8eea1055ca8e3570"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "createdByUserId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "payment"`
		);
		await queryRunner.query(`DROP TABLE "payment"`);
		await queryRunner.query(`ALTER TABLE "temporary_payment" RENAME TO "payment"`);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6337f8d52d8eea1055ca8e3570" ON "payment" ("createdByUserId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_6337f8d52d8eea1055ca8e3570"`);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME TO "temporary_payment"`);
		await queryRunner.query(
			`CREATE TABLE "payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "createdByUserId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_payment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_payment"`);
		await queryRunner.query(`CREATE INDEX "IDX_6337f8d52d8eea1055ca8e3570" ON "payment" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_6337f8d52d8eea1055ca8e3570"`);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME TO "temporary_payment"`);
		await queryRunner.query(
			`CREATE TABLE "payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "recordedById" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "createdByUserId", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_payment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_payment"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3f13c738eff604a85700746ec7" ON "payment" ("recordedById") `);
		await queryRunner.query(`DROP INDEX "IDX_82753b9e315af84b20eaf84d77"`);
		await queryRunner.query(`DROP INDEX "IDX_8846e403ec45e1ad8c309f91a3"`);
		await queryRunner.query(`DROP INDEX "IDX_3f13c738eff604a85700746ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_87223c7f1d4c2ca51cf6992784"`);
		await queryRunner.query(`DROP INDEX "IDX_62ef561a3bb084a7d12dad8a2d"`);
		await queryRunner.query(`DROP INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9"`);
		await queryRunner.query(`DROP INDEX "IDX_6959c37c3acf0832103a253570"`);
		await queryRunner.query(`DROP INDEX "IDX_16a49d62227bf23686b77b5a21"`);
		await queryRunner.query(`DROP INDEX "IDX_8c4018eab11e92c3b09583495f"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME TO "temporary_payment"`);
		await queryRunner.query(
			`CREATE TABLE "payment" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "paymentDate" datetime, "amount" numeric, "note" varchar, "currency" varchar NOT NULL, "paymentMethod" varchar, "overdue" boolean, "employeeId" varchar, "invoiceId" varchar, "recordedById" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_6959c37c3acf0832103a2535703" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_be7fcc9fb8cd5a74cb602ec6c9b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_62ef561a3bb084a7d12dad8a2d9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_3f13c738eff604a85700746ec7d" FOREIGN KEY ("recordedById") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_8846e403ec45e1ad8c309f91a37" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_82753b9e315af84b20eaf84d778" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "payment"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "paymentDate", "amount", "note", "currency", "paymentMethod", "overdue", "employeeId", "invoiceId", "recordedById", "projectId", "organizationContactId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_payment"`
		);
		await queryRunner.query(`DROP TABLE "temporary_payment"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_82753b9e315af84b20eaf84d77" ON "payment" ("organizationContactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8846e403ec45e1ad8c309f91a3" ON "payment" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3f13c738eff604a85700746ec7" ON "payment" ("recordedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_87223c7f1d4c2ca51cf6992784" ON "payment" ("invoiceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_62ef561a3bb084a7d12dad8a2d" ON "payment" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_be7fcc9fb8cd5a74cb602ec6c9" ON "payment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6959c37c3acf0832103a253570" ON "payment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a49d62227bf23686b77b5a21" ON "payment" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8c4018eab11e92c3b09583495f" ON "payment" ("isArchived") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_3f13c738eff604a85700746ec7d\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f13c738eff604a85700746ec7\` ON \`payment\``);
		await queryRunner.query(
			`ALTER TABLE \`payment\` CHANGE \`recordedById\` \`createdByUserId\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_6337f8d52d8eea1055ca8e3570\` ON \`payment\` (\`createdByUserId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_6337f8d52d8eea1055ca8e3570b\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_6337f8d52d8eea1055ca8e3570b\``);
		await queryRunner.query(`DROP INDEX \`IDX_6337f8d52d8eea1055ca8e3570\` ON \`payment\``);
		await queryRunner.query(
			`ALTER TABLE \`payment\` CHANGE \`createdByUserId\` \`recordedById\` varchar(255) NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_3f13c738eff604a85700746ec7\` ON \`payment\` (\`recordedById\`)`);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_3f13c738eff604a85700746ec7d\` FOREIGN KEY (\`recordedById\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
