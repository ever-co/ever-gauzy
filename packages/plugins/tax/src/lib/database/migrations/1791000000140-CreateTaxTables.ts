import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the tax rate table and the categories it belongs to.
 *
 * `tax_category` is the classification and `tax_rate` is the rate of a classification scoped
 * geographically and in time; between them they are what resolves a tax for a sale document. Neither
 * table stores an amount: the breakdown of a taxed document is a `tax_line` row owned by the platform,
 * and a second breakdown here would be a second answer to what a document was charged.
 *
 * `tax_rate` deliberately has no `status` column — a rate is live when its window contains the moment
 * and the row is not soft-deleted — and its `regionId` is an optional reference, so deleting a region
 * leaves the rate in place with the reference cleared.
 *
 * The two columns that point at `tax_category` from the platform's own tables
 * (`product_variant.taxCategoryId`, `organization_contact.taxCategoryId`) are created by the kernel
 * without their foreign key and constrained by `AddTaxCategoryForeignKeys1791000000150`, because this
 * set is what creates their target.
 */
export class CreateTaxTables1791000000140 implements MigrationInterface {
	name = 'CreateTaxTables1791000000140';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
			`CREATE TABLE "tax_category" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_tax_category_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_created_by_user" ON "tax_category" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_updated_by_user" ON "tax_category" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_deleted_by_user" ON "tax_category" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_is_active" ON "tax_category" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_is_archived" ON "tax_category" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_tenant" ON "tax_category" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_organization" ON "tax_category" ("organizationId")`);
		// A category's code is its identity inside the organization; the soft-deleted rows are excluded so
		// that a code can be used again after the category that held it was retired.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tax_category_org_code" ON "tax_category" ("organizationId", "code") WHERE "deletedAt" IS NULL`
		);
		// One default category per organization: a second default would make "the category of a variant that
		// names none" depend on the order rows come back in.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tax_category_default" ON "tax_category" ("organizationId") WHERE "isDefault" = true AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_category_org" ON "tax_category" ("organizationId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "tax_rate" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "taxCategoryId" uuid NOT NULL, "regionId" uuid, "countryCode" character varying(2), "provinceCode" character varying(16), "postalCodePattern" character varying(64), "rate" numeric(9,6) NOT NULL, "name" character varying(255) NOT NULL, "code" character varying(64), "isCompound" boolean NOT NULL DEFAULT false, "isInclusive" boolean, "isDefault" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT 0, "providerKey" character varying(64), "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "metadata" jsonb, CONSTRAINT "CHK_tax_rate_nonneg" CHECK ("rate" >= 0), CONSTRAINT "PK_tax_rate_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_created_by_user" ON "tax_rate" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_updated_by_user" ON "tax_rate" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_deleted_by_user" ON "tax_rate" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_is_active" ON "tax_rate" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_is_archived" ON "tax_rate" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_tenant" ON "tax_rate" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_organization" ON "tax_rate" ("organizationId")`);
		// The ladder reads the zone tuple, most specific level first.
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_zone" ON "tax_rate" ("regionId", "countryCode", "provinceCode", "taxCategoryId") WHERE "deletedAt" IS NULL`
		);
		// The tie-break inside one organization.
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_org_priority" ON "tax_rate" ("organizationId", "priority") WHERE "deletedAt" IS NULL`
		);
		// The window scan, which is what makes a rate live or not.
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_window" ON "tax_rate" ("startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		// The referential check of the category and the join every resolution starts from.
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_category" ON "tax_rate" ("taxCategoryId")`);
		await queryRunner.query(
			`ALTER TABLE "tax_rate" ADD CONSTRAINT "FK_tax_rate_tax_category" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		// A rate survives the deletion of the region it names: the destination a document carries is
		// snapshotted, and losing the region must not silently widen the rate to every destination.
		await queryRunner.query(
			`ALTER TABLE "tax_rate" ADD CONSTRAINT "FK_tax_rate_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "tax_rate" DROP CONSTRAINT "FK_tax_rate_region"`);
		await queryRunner.query(`ALTER TABLE "tax_rate" DROP CONSTRAINT "FK_tax_rate_tax_category"`);
		await queryRunner.query(`DROP TABLE "tax_rate"`);
		await queryRunner.query(`DROP TABLE "tax_category"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "tax_category" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT (0), "metadata" text)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_created_by_user" ON "tax_category" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_updated_by_user" ON "tax_category" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_deleted_by_user" ON "tax_category" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_is_active" ON "tax_category" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_is_archived" ON "tax_category" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_tenant" ON "tax_category" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_category_organization" ON "tax_category" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tax_category_org_code" ON "tax_category" ("organizationId", "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tax_category_default" ON "tax_category" ("organizationId") WHERE "isDefault" = 1 AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_category_org" ON "tax_category" ("organizationId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "tax_rate" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "taxCategoryId" varchar NOT NULL, "regionId" varchar, "countryCode" varchar(2), "provinceCode" varchar(16), "postalCodePattern" varchar(64), "rate" numeric(9,6) NOT NULL, "name" varchar(255) NOT NULL, "code" varchar(64), "isCompound" boolean NOT NULL DEFAULT (0), "isInclusive" boolean, "isDefault" boolean NOT NULL DEFAULT (0), "priority" integer NOT NULL DEFAULT (0), "providerKey" varchar(64), "startsAt" datetime, "endsAt" datetime, "metadata" text, CONSTRAINT "CHK_tax_rate_nonneg" CHECK ("rate" >= 0), CONSTRAINT "FK_tax_rate_tax_category" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tax_rate_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_created_by_user" ON "tax_rate" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_updated_by_user" ON "tax_rate" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_deleted_by_user" ON "tax_rate" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_is_active" ON "tax_rate" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_is_archived" ON "tax_rate" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_tenant" ON "tax_rate" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_organization" ON "tax_rate" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_zone" ON "tax_rate" ("regionId", "countryCode", "provinceCode", "taxCategoryId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_org_priority" ON "tax_rate" ("organizationId", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_rate_window" ON "tax_rate" ("startsAt", "endsAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_rate_category" ON "tax_rate" ("taxCategoryId")`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_category"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_window"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_org_priority"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_zone"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_rate_created_by_user"`);
		await queryRunner.query(`DROP TABLE "tax_rate"`);

		await queryRunner.query(`DROP INDEX "IDX_tax_category_org"`);
		await queryRunner.query(`DROP INDEX "UQ_tax_category_default"`);
		await queryRunner.query(`DROP INDEX "UQ_tax_category_org_code"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_category_created_by_user"`);
		await queryRunner.query(`DROP TABLE "tax_category"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`tax_category\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, INDEX \`IDX_tax_category_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_tax_category_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_tax_category_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_tax_category_is_active\` (\`isActive\`), INDEX \`IDX_tax_category_is_archived\` (\`isArchived\`), INDEX \`IDX_tax_category_tenant\` (\`tenantId\`), INDEX \`IDX_tax_category_organization\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no partial indexes. Uniqueness is still expressed on the tuple; the soft-deleted case
		// additionally relies on the service check, because MySQL treats nulls as distinct.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_tax_category_org_code\` ON \`tax_category\` (\`organizationId\`, \`code\`, \`deletedAt\`)`
		);
		// The one-default rule has no tuple to fall back on — the predicate is a boolean — so on MySQL it is
		// enforced by the service inside the writing transaction and reported by the nightly
		// `schema-uniqueness-audit` job.
		await queryRunner.query(
			`CREATE INDEX \`IDX_tax_category_org\` ON \`tax_category\` (\`organizationId\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`tax_rate\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`taxCategoryId\` varchar(36) NOT NULL, \`regionId\` varchar(36) NULL, \`countryCode\` varchar(2) NULL, \`provinceCode\` varchar(16) NULL, \`postalCodePattern\` varchar(64) NULL, \`rate\` decimal(9,6) NOT NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NULL, \`isCompound\` tinyint NOT NULL DEFAULT 0, \`isInclusive\` tinyint NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`priority\` int NOT NULL DEFAULT 0, \`providerKey\` varchar(64) NULL, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`metadata\` json NULL, INDEX \`IDX_tax_rate_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_tax_rate_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_tax_rate_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_tax_rate_is_active\` (\`isActive\`), INDEX \`IDX_tax_rate_is_archived\` (\`isArchived\`), INDEX \`IDX_tax_rate_tenant\` (\`tenantId\`), INDEX \`IDX_tax_rate_organization\` (\`organizationId\`), INDEX \`IDX_tax_rate_zone\` (\`regionId\`, \`countryCode\`, \`provinceCode\`, \`taxCategoryId\`), INDEX \`IDX_tax_rate_org_priority\` (\`organizationId\`, \`priority\`), INDEX \`IDX_tax_rate_window\` (\`startsAt\`, \`endsAt\`), INDEX \`IDX_tax_rate_category\` (\`taxCategoryId\`), CONSTRAINT \`CHK_tax_rate_nonneg\` CHECK (\`rate\` >= 0), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`tax_rate\` ADD CONSTRAINT \`FK_tax_rate_tax_category\` FOREIGN KEY (\`taxCategoryId\`) REFERENCES \`tax_category\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tax_rate\` ADD CONSTRAINT \`FK_tax_rate_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`region\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`tax_rate\` DROP FOREIGN KEY \`FK_tax_rate_region\``);
		await queryRunner.query(`ALTER TABLE \`tax_rate\` DROP FOREIGN KEY \`FK_tax_rate_tax_category\``);
		await queryRunner.query(`DROP TABLE \`tax_rate\``);
		await queryRunner.query(`DROP TABLE \`tax_category\``);
	}
}
