import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the physical layout of a stock location: its zones, the bins inside them, and the closure
 * table the bin tree is walked through.
 *
 * A zone is a named area of one building — receiving, storage, picking, packing, staging, shipping,
 * returns, quarantine, damage — and it is the unit the pick path is ordered by (`priority`) and the
 * unit the put-away and capacity rules select on (`isPickable`, `isReceivable`, the temperature
 * window). A bin is one addressable position inside a zone, and bins form a tree: an aisle holds
 * racks, a rack holds levels, a level holds positions.
 *
 * **The closure table is derived and never declared as an entity.** `warehouse_bin_closure` carries
 * one row per ancestor/descendant pair, including the self-pair every node has, which is what makes
 * "every pickable bin under this rack" one indexed join instead of a recursive query — a recursion
 * neither SQLite nor MySQL expresses efficiently. The ORM maintains it for the writes it performs and
 * `WarehouseBinService` maintains it for every re-parent, so the tree and its closure never disagree.
 *
 * The migration also adds the one constraint this package owes another: `warehouse_product_variant`
 * carries a nullable `binId` — the home bin of a level row — because the kernel set creates the
 * column for a table that does not exist yet, and the set that creates `warehouse_bin` is this one
 * (§24, rule 10). The constraint is added only when the column is present, so an installation that
 * has not applied the kernel alteration is left untouched rather than failed.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreateWarehouseLayoutTables1791000000180 implements MigrationInterface {
	name = 'CreateWarehouseLayoutTables1791000000180';

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
			`CREATE TABLE "warehouse_zone" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "type" character varying(16) NOT NULL DEFAULT 'STORAGE', "priority" integer NOT NULL DEFAULT 0, "isPickable" boolean NOT NULL DEFAULT true, "isReceivable" boolean NOT NULL DEFAULT false, "isShippable" boolean NOT NULL DEFAULT false, "isBlocked" boolean NOT NULL DEFAULT false, "minTemperature" numeric(6,2), "maxTemperature" numeric(6,2), "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "CHK_warehouse_zone_temperature" CHECK ("minTemperature" IS NULL OR "maxTemperature" IS NULL OR "minTemperature" <= "maxTemperature"), CONSTRAINT "PK_warehouse_zone_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_created_by_user" ON "warehouse_zone" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_updated_by_user" ON "warehouse_zone" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_deleted_by_user" ON "warehouse_zone" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_is_active" ON "warehouse_zone" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_is_archived" ON "warehouse_zone" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_tenant" ON "warehouse_zone" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_organization" ON "warehouse_zone" ("organizationId")`);
		// A zone code is the tenant's own key for an area and means one thing inside one location.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_zone_code" ON "warehouse_zone" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "code") WHERE "deletedAt" IS NULL`
		);
		// The pick path reads this one: the zones of a location, of one type, in walking order.
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_warehouse_type" ON "warehouse_zone" ("warehouseId", "type", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_pickable" ON "warehouse_zone" ("warehouseId", "isPickable") WHERE "isPickable" = true AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "warehouse_bin" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "warehouseId" uuid NOT NULL, "zoneId" uuid, "parentId" uuid, "code" character varying(64) NOT NULL, "barcode" character varying(64), "type" character varying(16) NOT NULL DEFAULT 'SHELF', "isPickable" boolean NOT NULL DEFAULT true, "isBlocked" boolean NOT NULL DEFAULT false, "capacityUnits" numeric(20,6), "maxWeight" numeric(12,4), "maxVolume" numeric(12,4), "aisle" character varying(32), "rack" character varying(32), "level" character varying(32), "position" character varying(32), "sortOrder" integer NOT NULL DEFAULT 0, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "FK_warehouse_bin_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_parent" FOREIGN KEY ("parentId") REFERENCES "warehouse_bin"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "PK_warehouse_bin_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_created_by_user" ON "warehouse_bin" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_updated_by_user" ON "warehouse_bin" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_deleted_by_user" ON "warehouse_bin" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_is_active" ON "warehouse_bin" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_is_archived" ON "warehouse_bin" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_tenant" ON "warehouse_bin" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_organization" ON "warehouse_bin" ("organizationId")`);
		// The label printed on a pick list is unique inside its location.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_bin_code" ON "warehouse_bin" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_bin_barcode" ON "warehouse_bin" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "barcode") WHERE "barcode" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_zone_pickable" ON "warehouse_bin" ("zoneId", "isPickable", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_warehouse_parent" ON "warehouse_bin" ("warehouseId", "parentId", "sortOrder") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "warehouse_bin_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_warehouse_bin_closure" PRIMARY KEY ("id_ancestor", "id_descendant"), CONSTRAINT "FK_warehouse_bin_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "warehouse_bin"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "warehouse_bin"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_closure_ancestor" ON "warehouse_bin_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_closure_descendant" ON "warehouse_bin_closure" ("id_descendant")`
		);

		// The home bin of a level row: the column is created by the kernel set, the target table by
		// this one, so this is the set that adds the constraint.
		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await queryRunner.query(
				`ALTER TABLE "warehouse_product_variant" ADD CONSTRAINT "FK_warehouse_product_variant_bin" FOREIGN KEY ("binId") REFERENCES "warehouse_bin"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await queryRunner.query(
				`ALTER TABLE "warehouse_product_variant" DROP CONSTRAINT "FK_warehouse_product_variant_bin"`
			);
		}

		await queryRunner.query(`DROP TABLE "warehouse_bin_closure"`);
		await queryRunner.query(`DROP TABLE "warehouse_bin"`);
		await queryRunner.query(`DROP TABLE "warehouse_zone"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite stores a `jsonb` column as text and has no native uuid type, so the inherited block and
	 * every domain column are written in the dialect's own vocabulary. One comma per column list: the
	 * comma that ends the columns and the comma that begins the constraints are the same comma.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "warehouse_zone" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "type" varchar(16) NOT NULL DEFAULT ('STORAGE'), "priority" integer NOT NULL DEFAULT (0), "isPickable" boolean NOT NULL DEFAULT (1), "isReceivable" boolean NOT NULL DEFAULT (0), "isShippable" boolean NOT NULL DEFAULT (0), "isBlocked" boolean NOT NULL DEFAULT (0), "minTemperature" numeric(6,2), "maxTemperature" numeric(6,2), "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "CHK_warehouse_zone_temperature" CHECK ("minTemperature" IS NULL OR "maxTemperature" IS NULL OR "minTemperature" <= "maxTemperature"), CONSTRAINT "FK_warehouse_zone_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_created_by_user" ON "warehouse_zone" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_updated_by_user" ON "warehouse_zone" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_deleted_by_user" ON "warehouse_zone" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_is_active" ON "warehouse_zone" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_is_archived" ON "warehouse_zone" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_tenant" ON "warehouse_zone" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_zone_organization" ON "warehouse_zone" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_zone_code" ON "warehouse_zone" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_warehouse_type" ON "warehouse_zone" ("warehouseId", "type", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_zone_pickable" ON "warehouse_zone" ("warehouseId", "isPickable") WHERE "isPickable" = 1 AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "warehouse_bin" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "warehouseId" varchar NOT NULL, "zoneId" varchar, "parentId" varchar, "code" varchar(64) NOT NULL, "barcode" varchar(64), "type" varchar(16) NOT NULL DEFAULT ('SHELF'), "isPickable" boolean NOT NULL DEFAULT (1), "isBlocked" boolean NOT NULL DEFAULT (0), "capacityUnits" numeric(20,6), "maxWeight" numeric(12,4), "maxVolume" numeric(12,4), "aisle" varchar(32), "rack" varchar(32), "level" varchar(32), "position" varchar(32), "sortOrder" integer NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "metadata" text, CONSTRAINT "FK_warehouse_bin_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_zone" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zone" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_parent" FOREIGN KEY ("parentId") REFERENCES "warehouse_bin" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_created_by_user" ON "warehouse_bin" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_updated_by_user" ON "warehouse_bin" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_deleted_by_user" ON "warehouse_bin" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_is_active" ON "warehouse_bin" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_is_archived" ON "warehouse_bin" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_tenant" ON "warehouse_bin" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_warehouse_bin_organization" ON "warehouse_bin" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_bin_code" ON "warehouse_bin" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "warehouseId", "code") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_warehouse_bin_barcode" ON "warehouse_bin" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "barcode") WHERE "barcode" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_zone_pickable" ON "warehouse_bin" ("zoneId", "isPickable", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_warehouse_parent" ON "warehouse_bin" ("warehouseId", "parentId", "sortOrder") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "warehouse_bin_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, CONSTRAINT "PK_warehouse_bin_closure" PRIMARY KEY ("id_ancestor", "id_descendant"), CONSTRAINT "FK_warehouse_bin_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "warehouse_bin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_warehouse_bin_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "warehouse_bin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_closure_ancestor" ON "warehouse_bin_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_warehouse_bin_closure_descendant" ON "warehouse_bin_closure" ("id_descendant")`
		);

		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await this.rebuildSqliteTableWithBinForeignKey(queryRunner, 'warehouse_product_variant');
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await this.rebuildSqliteTableWithoutBinForeignKey(queryRunner, 'warehouse_product_variant');
		}

		await queryRunner.query(`DROP TABLE "warehouse_bin_closure"`);
		await queryRunner.query(`DROP TABLE "warehouse_bin"`);
		await queryRunner.query(`DROP TABLE "warehouse_zone"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`warehouse_zone\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`type\` varchar(16) NOT NULL DEFAULT 'STORAGE', \`priority\` int NOT NULL DEFAULT 0, \`isPickable\` tinyint NOT NULL DEFAULT 1, \`isReceivable\` tinyint NOT NULL DEFAULT 0, \`isShippable\` tinyint NOT NULL DEFAULT 0, \`isBlocked\` tinyint NOT NULL DEFAULT 0, \`minTemperature\` decimal(6,2) NULL, \`maxTemperature\` decimal(6,2) NULL, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_warehouse_zone_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_warehouse_zone_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_warehouse_zone_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_warehouse_zone_is_active\` (\`isActive\`), INDEX \`IDX_warehouse_zone_is_archived\` (\`isArchived\`), INDEX \`IDX_warehouse_zone_tenant\` (\`tenantId\`), INDEX \`IDX_warehouse_zone_organization\` (\`organizationId\`), INDEX \`IDX_warehouse_zone_warehouse_type\` (\`warehouseId\`, \`type\`, \`priority\`), INDEX \`IDX_warehouse_zone_pickable\` (\`warehouseId\`, \`isPickable\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no partial index, so the uniqueness a deleted row must not consume is carried by the
		// stored generated `deletedKey`, and the nullable organization scope by `organizationKey`.
		// Carrying `deletedAt` itself would leave the rule unenforced: a null key part exempts the whole
		// tuple on this dialect, and every live row's `deletedAt` is null.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_warehouse_zone_code\` ON \`warehouse_zone\` (\`organizationKey\`, \`warehouseId\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_zone\` ADD CONSTRAINT \`CHK_warehouse_zone_temperature\` CHECK (\`minTemperature\` IS NULL OR \`maxTemperature\` IS NULL OR \`minTemperature\` <= \`maxTemperature\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_zone\` ADD CONSTRAINT \`FK_warehouse_zone_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`warehouse_bin\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`warehouseId\` varchar(36) NOT NULL, \`zoneId\` varchar(36) NULL, \`parentId\` varchar(36) NULL, \`code\` varchar(64) NOT NULL, \`barcode\` varchar(64) NULL, \`type\` varchar(16) NOT NULL DEFAULT 'SHELF', \`isPickable\` tinyint NOT NULL DEFAULT 1, \`isBlocked\` tinyint NOT NULL DEFAULT 0, \`capacityUnits\` decimal(20,6) NULL, \`maxWeight\` decimal(12,4) NULL, \`maxVolume\` decimal(12,4) NULL, \`aisle\` varchar(32) NULL, \`rack\` varchar(32) NULL, \`level\` varchar(32) NULL, \`position\` varchar(32) NULL, \`sortOrder\` int NOT NULL DEFAULT 0, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_warehouse_bin_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_warehouse_bin_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_warehouse_bin_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_warehouse_bin_is_active\` (\`isActive\`), INDEX \`IDX_warehouse_bin_is_archived\` (\`isArchived\`), INDEX \`IDX_warehouse_bin_tenant\` (\`tenantId\`), INDEX \`IDX_warehouse_bin_organization\` (\`organizationId\`), INDEX \`IDX_warehouse_bin_zone_pickable\` (\`zoneId\`, \`isPickable\`, \`sortOrder\`), INDEX \`IDX_warehouse_bin_warehouse_parent\` (\`warehouseId\`, \`parentId\`, \`sortOrder\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_warehouse_bin_code\` ON \`warehouse_bin\` (\`organizationKey\`, \`warehouseId\`, \`code\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_warehouse_bin_barcode\` ON \`warehouse_bin\` (\`organizationKey\`, \`barcode\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_bin\` ADD CONSTRAINT \`FK_warehouse_bin_warehouse\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_bin\` ADD CONSTRAINT \`FK_warehouse_bin_zone\` FOREIGN KEY (\`zoneId\`) REFERENCES \`warehouse_zone\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_bin\` ADD CONSTRAINT \`FK_warehouse_bin_parent\` FOREIGN KEY (\`parentId\`) REFERENCES \`warehouse_bin\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`warehouse_bin_closure\` (\`id_ancestor\` varchar(36) NOT NULL, \`id_descendant\` varchar(36) NOT NULL, INDEX \`IDX_warehouse_bin_closure_ancestor\` (\`id_ancestor\`), INDEX \`IDX_warehouse_bin_closure_descendant\` (\`id_descendant\`), PRIMARY KEY (\`id_ancestor\`, \`id_descendant\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_bin_closure\` ADD CONSTRAINT \`FK_warehouse_bin_closure_ancestor\` FOREIGN KEY (\`id_ancestor\`) REFERENCES \`warehouse_bin\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_bin_closure\` ADD CONSTRAINT \`FK_warehouse_bin_closure_descendant\` FOREIGN KEY (\`id_descendant\`) REFERENCES \`warehouse_bin\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await queryRunner.query(
				`ALTER TABLE \`warehouse_product_variant\` ADD CONSTRAINT \`FK_warehouse_product_variant_bin\` FOREIGN KEY (\`binId\`) REFERENCES \`warehouse_bin\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('warehouse_product_variant', 'binId')) {
			await queryRunner.query(
				`ALTER TABLE \`warehouse_product_variant\` DROP FOREIGN KEY \`FK_warehouse_product_variant_bin\``
			);
		}

		await queryRunner.query(`DROP TABLE \`warehouse_bin_closure\``);
		await queryRunner.query(`DROP TABLE \`warehouse_bin\``);
		await queryRunner.query(`DROP TABLE \`warehouse_zone\``);
	}

	/**
	 * Rebuilds a SQLite table with the home-bin foreign key added.
	 *
	 * SQLite cannot add a constraint to an existing table, so the table is rebuilt from its own
	 * definition with the constraint appended — the only way this dialect expresses a constraint
	 * change. The guard makes a second run a no-op.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 */
	private async rebuildSqliteTableWithBinForeignKey(queryRunner: QueryRunner, table: string): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || definition.includes('FK_warehouse_product_variant_bin')) {
			return;
		}

		const withConstraint = definition.replace(
			/\)\s*$/,
			`, CONSTRAINT "FK_warehouse_product_variant_bin" FOREIGN KEY ("binId") REFERENCES "warehouse_bin" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);

		/*
		 * Two pragmas, for two different reasons.
		 *
		 * `foreign_keys = OFF` lets the rows be copied into the rebuilt table without every constraint
		 * being re-checked mid-rebuild. `legacy_alter_table = ON` is the one that keeps the *other*
		 * tables' definitions honest: since SQLite 3.25 a `RENAME TO` also rewrites the foreign keys of
		 * tables that referenced the renamed one, so renaming this table aside left
		 * `stock_movement`, `stock_reservation`, `stock_adjustment` and `stock_count_line` pointing at
		 * `warehouse_product_variant_bin_fk_backup` — the name the last statement drops. Their
		 * definitions stayed valid, so nothing failed at migration time; every later write to one of them
		 * failed at prepare time with "no such table". `legacy_alter_table` restores the behaviour this
		 * rebuild was written against.
		 */
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await queryRunner.query('PRAGMA legacy_alter_table = ON');
		try {
			await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_bin_fk_backup"`);
			await queryRunner.query(withConstraint);
			await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_bin_fk_backup"`);
			await queryRunner.query(`DROP TABLE "${table}_bin_fk_backup"`);
		} finally {
			await queryRunner.query('PRAGMA legacy_alter_table = OFF');
			await queryRunner.query('PRAGMA foreign_keys = ON');
		}
	}

	/**
	 * Rebuilds a SQLite table with the home-bin foreign key removed.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 */
	private async rebuildSqliteTableWithoutBinForeignKey(queryRunner: QueryRunner, table: string): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || !definition.includes('FK_warehouse_product_variant_bin')) {
			return;
		}

		const withoutConstraint = definition.replace(
			/,\s*CONSTRAINT "FK_warehouse_product_variant_bin"[^)]*\)\s*\)\s*$/,
			')'
		);

		// The same two pragmas as the rebuild above: `foreign_keys` off for the copy, and
		// `legacy_alter_table` on so the rename does not rewrite other tables' foreign keys to name the
		// backup this method is about to drop.
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await queryRunner.query('PRAGMA legacy_alter_table = ON');
		try {
			await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_bin_fk_backup"`);
			await queryRunner.query(withoutConstraint);
			await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_bin_fk_backup"`);
			await queryRunner.query(`DROP TABLE "${table}_bin_fk_backup"`);
		} finally {
			await queryRunner.query('PRAGMA legacy_alter_table = OFF');
			await queryRunner.query('PRAGMA foreign_keys = ON');
		}
	}

	/**
	 * Reads a SQLite table's own `CREATE TABLE` statement.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The statement, or null when the table does not exist.
	 */
	private async sqliteDefinitionOf(queryRunner: QueryRunner, table: string): Promise<string | null> {
		const rows: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
			[table]
		);

		return rows?.[0]?.sql ?? null;
	}
}
