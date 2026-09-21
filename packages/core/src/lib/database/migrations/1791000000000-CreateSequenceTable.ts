import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the numbering series table.
 *
 * A series hands out the human-facing numbers that documents are quoted by. The table is part of the
 * platform kernel rather than of any one capability, because invoices, orders, returns, purchase
 * orders and internal references all number their documents the same way.
 *
 * ## The generated key columns, which every migration after this one reuses
 *
 * This is the first migration of the set, so the convention the rest of the set follows is stated here
 * once and referred to by name afterwards.
 *
 * Postgres and SQLite say "unique among the rows that satisfy P" with a **partial index**:
 * `CREATE UNIQUE INDEX … WHERE "deletedAt" IS NULL`. MySQL and MariaDB have no such thing. Putting the
 * predicate's column into the tuple instead — `(…, deletedAt)` — looks like the same rule and is
 * not one: a unique index in MySQL exempts **every** tuple that contains a `NULL`, and `deletedAt` is
 * `NULL` on every row that has not been deleted, so such an index accepts unlimited duplicates among
 * exactly the rows it was written to constrain.
 *
 * What MySQL does have is the **stored generated column**, supported since MySQL 5.7 and MariaDB 10.2 —
 * unlike a functional key part, which needs MySQL 8.0.13 and does not exist on MariaDB at all. The
 * predicate is encoded into a column and the column joins the tuple:
 *
 * ```sql
 * `deletedKey` varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED
 * CREATE UNIQUE INDEX `UQ_x` ON `t` (`colA`, `colB`, `deletedKey`)
 * ```
 *
 * A row that satisfies the predicate takes the shared constant, so all such rows compete on
 * `(colA, colB)` exactly as the partial index makes them compete; a row that does not takes its own
 * `id`, which nothing else can equal, so it can never collide — which is what "excluded from the index"
 * means. The names are fixed across the set: **`deletedKey`** for `"deletedAt" IS NULL`, which is one
 * column per table however many indexes use it, and `<column>Key` for anything else — `noChannelKey`
 * here, `isDefaultKey`, `isPrimaryKey`, `openStatusKey` elsewhere. They exist on MySQL only, no entity
 * declares them, and `down()` drops the table (or the index and then the column) that carries them.
 *
 * ## The nullable member of a tuple, which is a defect on all three dialects
 *
 * `organizationId` is nullable, and no dialect compares two `NULL`s equal, so
 * `("organizationId", "key")` enforces nothing at all for a series that has no organization — on
 * MySQL because a null key part is exempt, on Postgres and SQLite because the two rows differ. Where the
 * rule means "two rows with no organization are the same row", the null is folded to the nil UUID:
 * `COALESCE("organizationId", '00000000-0000-0000-0000-000000000000')` in the Postgres and SQLite index
 * expression, the generated `organizationKey` on MySQL. Where a null is meant to exempt the row the
 * predicate says so — `WHERE "channelId" IS NOT NULL` below — and the column stays raw on every dialect,
 * MySQL's own null rule being the exemption there.
 */
export class CreateSequenceTable1791000000000 implements MigrationInterface {
	name = 'CreateSequenceTable1791000000000';

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
			`CREATE TABLE "sequence" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "key" character varying NOT NULL, "prefix" character varying, "padding" integer NOT NULL DEFAULT 1, "nextValue" integer NOT NULL DEFAULT 1, "step" integer NOT NULL DEFAULT 1, "resetPolicy" character varying NOT NULL DEFAULT 'NEVER', "lastResetAt" TIMESTAMP, "description" character varying, "channelId" uuid, CONSTRAINT "PK_sequence_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_created_by_user" ON "sequence" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_updated_by_user" ON "sequence" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_deleted_by_user" ON "sequence" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_is_active" ON "sequence" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_is_archived" ON "sequence" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_tenant" ON "sequence" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_organization" ON "sequence" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_key" ON "sequence" ("key")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_channel" ON "sequence" ("channelId")`);
		// A series is unique per organization and key, and per channel when it is channel scoped.
		// Two partial indexes express that, because a single index would let a channel series and an
		// organization series coexist under the same key only by accident of null handling.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_sequence_org_key_no_channel" ON "sequence" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "key") WHERE "channelId" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_sequence_org_channel_key" ON "sequence" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "channelId", "key") WHERE "channelId" IS NOT NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "sequence"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "sequence" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "prefix" varchar, "padding" integer NOT NULL DEFAULT (1), "nextValue" integer NOT NULL DEFAULT (1), "step" integer NOT NULL DEFAULT (1), "resetPolicy" varchar NOT NULL DEFAULT ('NEVER'), "lastResetAt" datetime, "description" varchar, "channelId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_created_by_user" ON "sequence" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_updated_by_user" ON "sequence" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_deleted_by_user" ON "sequence" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_is_active" ON "sequence" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_is_archived" ON "sequence" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_tenant" ON "sequence" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_organization" ON "sequence" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_key" ON "sequence" ("key")`);
		await queryRunner.query(`CREATE INDEX "IDX_sequence_channel" ON "sequence" ("channelId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_sequence_org_key_no_channel" ON "sequence" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "key") WHERE "channelId" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_sequence_org_channel_key" ON "sequence" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "channelId", "key") WHERE "channelId" IS NOT NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_sequence_channel"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_key"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_sequence_created_by_user"`);
		await queryRunner.query(`DROP INDEX "UQ_sequence_org_key_no_channel"`);
		await queryRunner.query(`DROP INDEX "UQ_sequence_org_channel_key"`);
		await queryRunner.query(`DROP TABLE "sequence"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`sequence\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`key\` varchar(255) NOT NULL, \`prefix\` varchar(255) NULL, \`padding\` int NOT NULL DEFAULT 1, \`nextValue\` int NOT NULL DEFAULT 1, \`step\` int NOT NULL DEFAULT 1, \`resetPolicy\` varchar(255) NOT NULL DEFAULT 'NEVER', \`lastResetAt\` datetime NULL, \`description\` varchar(255) NULL, \`channelId\` varchar(36) NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`noChannelKey\` varchar(36) GENERATED ALWAYS AS (IF(\`channelId\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_sequence_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_sequence_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_sequence_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_sequence_is_active\` (\`isActive\`), INDEX \`IDX_sequence_is_archived\` (\`isArchived\`), INDEX \`IDX_sequence_tenant\` (\`tenantId\`), INDEX \`IDX_sequence_organization\` (\`organizationId\`), INDEX \`IDX_sequence_key\` (\`key\`), INDEX \`IDX_sequence_channel\` (\`channelId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// The same two rules, through the generated key columns declared above: `organizationKey` folds
		// the null organization so the tuple applies to a series that has none, `deletedKey` carries
		// `"deletedAt" IS NULL`, and `noChannelKey` carries `"channelId" IS NULL` — a predicate MySQL's
		// own null rule cannot stand in for, because it selects the null rows rather than excusing them.
		// The channel-scoped index needs no such column: `channelId` is already a member of its tuple, so
		// MySQL exempts the channel-less rows by itself, which is exactly `WHERE "channelId" IS NOT NULL`.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_sequence_org_key_no_channel\` ON \`sequence\` (\`organizationKey\`, \`key\`, \`noChannelKey\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_sequence_org_channel_key\` ON \`sequence\` (\`organizationKey\`, \`channelId\`, \`key\`, \`deletedKey\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`sequence\``);
	}
}
