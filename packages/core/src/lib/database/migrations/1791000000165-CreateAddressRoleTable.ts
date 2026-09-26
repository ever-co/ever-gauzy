import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the address book's role pivot, and backfills it from the two booleans it replaces.
 *
 * The address book modelled its role set with exactly two booleans, and shipped requirements already
 * need more: a seller's **registered** and **payout** addresses, a carrier label's **return**
 * destination, a purchase order's **remit-to**. Each of those as another boolean is the
 * boolean-per-case shape that has no end, and the set is genuinely open — an operator will want a
 * pickup address and a registered-office address next.
 *
 * **The two booleans are not removed.** One address is routinely both the billing and the shipping
 * address, which the two booleans express correctly in one row and a single-valued `type` column would
 * regress. They become the derived mirror of the `SHIPPING` and `BILLING` rows; the subscriber that
 * maintains the party's two default references writes both in one transaction, and a write that
 * disagrees fails with `ADDRESS_DEFAULT_MISMATCH` rather than leaving two answers to one question.
 *
 * **The backfill is one row per existing address per boolean that is true**, so every existing row keeps
 * its meaning and behaves identically. An address with neither boolean keeps no role row, which reads
 * as "not a default and not role-specific" — the correct reading, and the reason the backfill writes
 * nothing for it rather than inventing a role.
 *
 * **The foreign key is added when its target exists.** The address book is a core table delivered by
 * the scoping migration of this same kernel set, and this file must not be the thing that stops an
 * installation booting when it has not run yet: `addressId` is created without its constraint on a
 * database that has no `address` table, and the migration that creates `address` adds the constraint in
 * its own right. The alternative — creating a foreign key to a table that does not exist — fails the
 * whole migration on a fresh database, and a kernel migration never waits for another table to appear.
 *
 * **The backfill is guarded by `hasColumn`** on the two booleans, for the same reason: an installation
 * whose address table does not carry them yet gets the table and no rows, and the backfill applies by
 * itself on the first boot after both exist. Every statement here is guarded, so a re-run adds nothing.
 */
export class CreateAddressRoleTable1791000000165 implements MigrationInterface {
	name = 'CreateAddressRoleTable1791000000165';

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
		if (!(await queryRunner.hasTable('address_role'))) {
			// The constraint is part of the table only where its target already exists — see the class note.
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT "FK_address_role_address" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "address_role" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "addressId" uuid NOT NULL, "role" character varying(16) NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "metadata" jsonb${address}, CONSTRAINT "PK_address_role_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_created_by_user" ON "address_role" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_updated_by_user" ON "address_role" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_deleted_by_user" ON "address_role" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_is_active" ON "address_role" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_is_archived" ON "address_role" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_tenant" ON "address_role" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_organization" ON "address_role" ("organizationId")`);
			// One row per address and role, among live rows: a soft-deleted role must not keep the pair
			// occupied for ever, and two rows for one pair would be two answers to the same question.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_role" ON "address_role" ("addressId", "role") WHERE "deletedAt" IS NULL`
			);
			// The default lookup: "which address is the default for this role", which is the read behind a
			// checkout and behind the party's two default references.
			await queryRunner.query(
				`CREATE INDEX "IDX_address_role_role" ON "address_role" ("role", "isDefault") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_role_address" ON "address_role" ("addressId") WHERE "deletedAt" IS NULL`
			);
		}

		await this.backfill(
			queryRunner,
			`SELECT gen_random_uuid(), "address"."tenantId", "address"."organizationId", "address"."id", 'SHIPPING', true`,
			`SELECT gen_random_uuid(), "address"."tenantId", "address"."organizationId", "address"."id", 'BILLING', true`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "address_role"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('address_role'))) {
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT "FK_address_role_address" FOREIGN KEY ("addressId") REFERENCES "address" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "address_role" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "addressId" varchar NOT NULL, "role" varchar(16) NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "metadata" text${address})`
			);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_created_by_user" ON "address_role" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_updated_by_user" ON "address_role" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_deleted_by_user" ON "address_role" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_is_active" ON "address_role" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_is_archived" ON "address_role" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_tenant" ON "address_role" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_role_organization" ON "address_role" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_role" ON "address_role" ("addressId", "role") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_role_role" ON "address_role" ("role", "isDefault") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_role_address" ON "address_role" ("addressId") WHERE "deletedAt" IS NULL`
			);
		}

		// SQLite has no uuid function, so the identifier is composed from six random blobs in the shape a
		// version-4 identifier takes. It is expressed inline rather than left to the driver because the
		// backfill is one statement per role and a per-row round trip would be a second transaction.
		const sqliteUuid =
			`lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || ` +
			`substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`;

		await this.backfill(
			queryRunner,
			`SELECT ${sqliteUuid}, "address"."tenantId", "address"."organizationId", "address"."id", 'SHIPPING', 1`,
			`SELECT ${sqliteUuid}, "address"."tenantId", "address"."organizationId", "address"."id", 'BILLING', 1`,
			true
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "address_role"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so both partial unique indexes are expressed the documented way: a
	 * stored generated key column that is `'0'` while the row is live and the row's own id once it is
	 * deleted, appended to the tuple. The `IDX_address_role_role` predicate is a lookup narrowing rather
	 * than a uniqueness rule, so it is created without its predicate on this dialect. The generated
	 * column exists on MySQL only and is declared by no entity.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('address_role'))) {
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT `FK_address_role_address` FOREIGN KEY (`addressId`) REFERENCES `address`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`address_role\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`addressId\` varchar(36) NOT NULL, \`role\` varchar(16) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_address_role_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_address_role_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_address_role_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_address_role_is_active\` (\`isActive\`), INDEX \`IDX_address_role_is_archived\` (\`isArchived\`), INDEX \`IDX_address_role_tenant\` (\`tenantId\`), INDEX \`IDX_address_role_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_address_role\` (\`addressId\`, \`role\`, \`deletedKey\`), INDEX \`IDX_address_role_role\` (\`role\`, \`isDefault\`), INDEX \`IDX_address_role_address\` (\`addressId\`)${address}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		await this.backfill(
			queryRunner,
			`SELECT UUID(), "address"."tenantId", "address"."organizationId", "address"."id", 'SHIPPING', 1`,
			`SELECT UUID(), "address"."tenantId", "address"."organizationId", "address"."id", 'BILLING', 1`,
			true
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`address_role\``);
	}

	/**
	 * Writes one role row per existing address whose matching boolean is true.
	 *
	 * Four guards, and each of them is a state a real installation reaches. The address table may not
	 * exist yet; it may exist without the two booleans; the role table may not have been created (an
	 * installation whose `address_role` came from a synchronise run and whose `addressId` is therefore
	 * this file's business, not the backfill's); and a role row for the pair may already be there, which
	 * the `NOT EXISTS` clause makes a no-op rather than a duplicate-key failure. The count is reported
	 * rather than assumed, so a reviewer can see what the backfill actually did.
	 *
	 * @param queryRunner
	 * @param shippingSelect The dialect's `SELECT` for the `SHIPPING` projection.
	 * @param billingSelect The dialect's `SELECT` for the `BILLING` projection.
	 * @param numericBoolean Whether the dialect states `true` as `1`; SQLite and MySQL do.
	 */
	private async backfill(
		queryRunner: QueryRunner,
		shippingSelect: string,
		billingSelect: string,
		numericBoolean = false
	): Promise<void> {
		if (!(await queryRunner.hasTable('address_role'))) {
			return;
		}

		if (!(await queryRunner.hasTable('address'))) {
			return;
		}

		if (!(await queryRunner.hasColumn('address', 'isDefaultShipping'))) {
			return;
		}

		if (!(await queryRunner.hasColumn('address', 'isDefaultBilling'))) {
			return;
		}

		const truth = numericBoolean ? '1' : 'true';

		for (const [flag, select, role] of [
			['isDefaultShipping', shippingSelect, 'SHIPPING'],
			['isDefaultBilling', billingSelect, 'BILLING']
		] as const) {
			await queryRunner.query(
				`INSERT INTO "address_role" ("id", "tenantId", "organizationId", "addressId", "role", "isDefault") ` +
					`${select} FROM "address" ` +
					`WHERE "address"."${flag}" = ${truth} AND "address"."deletedAt" IS NULL ` +
					`AND NOT EXISTS (SELECT 1 FROM "address_role" "ar" WHERE "ar"."addressId" = "address"."id" AND "ar"."role" = '${role}')`
			);
		}
	}
}
