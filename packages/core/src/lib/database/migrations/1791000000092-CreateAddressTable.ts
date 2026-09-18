import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the address book: the reusable postal addresses a party, a location or the organization
 * itself owns, and the row an order snapshots rather than points at.
 *
 * **Why one address table is a kernel concern.** The platform already carries exactly one address per
 * contact — three free-text fields on the shared contact row — and that shape cannot answer the
 * questions the shipped documents ask of it: which address a cart ships to, which one an invoice is
 * issued to, which one a carrier label prints as the return destination, which one a purchase order
 * prints as its remit-to. A customer routinely has a home address and a work address; a warehouse is a
 * location with coordinates but no party; a seller and a supplier each have addresses the platform
 * must remember. One row per party cannot hold any of that, and a second address-shaped column per
 * case is the column-per-case shape with no end. The book is therefore the kernel's postal-address
 * model, sitting beside `contact` and never overwriting it — `contact` keeps its own address and the
 * book is added next to it.
 *
 * **The tick must precede `1791000000125` and `1791000000165`, and that is not a preference.** Two
 * delivered migrations name this table in a foreign key they create **only where it already exists**:
 * `1791000000125-CreatePaymentInstrumentTables` guards the constraint from `payment_method_token.
 * billingAddressId` with `hasTable('address')`, and `1791000000165-CreateAddressRoleTable` guards the
 * one from `address_role.addressId` the same way. Both guards were written because this table did not
 * exist when they shipped, so today an installation has a scope pivot and an instrument column that
 * point at nothing. This migration runs before both, so a fresh installation creates the table first
 * and each of those two files adds its own constraint inline as it was written to; an installation
 * that already ran them gets the table here and the two missing constraints from
 * `1791000000170-AddAddressBookForeignKeys`, which is exactly the migration whose existence the
 * platform's rule — a migration may only reference a table an **earlier** migration creates —
 * requires. The tick is therefore fixed at `1791000000092` and must not be moved: raising it above
 * either file would turn both inline constraints into permanently skipped branches.
 *
 * **The owner is a dimension, not another nullable foreign key.** `ownerType` names what kind of thing
 * the address belongs to (`CONTACT` / `WAREHOUSE` / `SELLER` / `VENDOR` / `ORGANIZATION`) and `ownerId`
 * names the row, with **no foreign key**: the target table depends on the type, which is the platform's
 * existing polymorphic shape (`rule`, `adjustment`, `tax_line`) and carries the same mitigation — a
 * referential-integrity audit rather than a constraint. The alternative was a nullable `warehouseId`,
 * `sellerId`, `vendorId` column per addressable thing.
 *
 * **Two references are real foreign keys and two rules are not.** `customerId` cascades from
 * `organization_contact` and `countryId` releases to null from `country`, both with the policy the
 * schema chapter's `onDelete` table assigns their bucket. The two default booleans cannot be a
 * database rule on every dialect (see the MySQL note), and "at most one default per owner and role"
 * spans `address` and `address_role`, so it is the service's rule plus the nightly
 * `address-default-reconcile` rather than an index — the compromise the schema chapter states for a
 * cross-table tuple.
 *
 * **Every statement is guarded by `hasTable`.** A migration is a file an installation may already have
 * applied out of band — a development database synchronised from the entities has the table and none
 * of this migration's history — and a second run must therefore add nothing rather than fail on the
 * first `CREATE TABLE`. The two foreign keys are appended only where their target exists, for the same
 * reason the two delivered files guard theirs: a constraint to a table that is not there fails the
 * whole migration, and a kernel migration never waits for another table to appear.
 *
 * **MySQL has no filtered index**, so the two uniqueness rules this table carries are treated exactly
 * as the newest kernel DDL treats its value-guarded rules. A partial unique index whose predicate is a
 * **nullable** column can be expressed on this dialect by appending a stored generated key column, but
 * neither of these two has that shape: `UQ_address_default_shipping` and `UQ_address_default_billing`
 * are guarded by a **boolean** (`"isDefaultShipping" = true`), and appending a
 * `IF("deletedAt" IS NULL, '0', "id")` key to `(customerId)` would forbid a party its second **live**
 * address rather than its second default — a constraint that silently means something else is worse
 * than none, because it reads as enforcement and is not. Nor is there a generated-column form for the
 * predicate itself in the supported range (which includes MariaDB, where the functional-key-part
 * alternative is unavailable). Both rules are therefore enforced by `AddressService` inside the
 * writing transaction — the default write takes a row lock on the address and clears its siblings
 * before it sets the flag — and re-reported nightly by the schema audit, which is the documented
 * fallback. The remaining domain indexes are lookup narrowings rather than uniqueness rules, so this
 * dialect gets them without their predicate.
 */
export class CreateAddressTable1791000000092 implements MigrationInterface {
	name = 'CreateAddressTable1791000000092';

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
		if (!(await queryRunner.hasTable('address'))) {
			// Both references are part of the table wherever their target exists — see the class note.
			const customer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_address_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT "FK_address_country" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "address" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "label" character varying(64), "contactName" character varying(255), "company" character varying(255), "firstName" character varying(128), "lastName" character varying(128), "phone" character varying(32), "email" character varying(255), "line1" character varying(255) NOT NULL, "line2" character varying(255), "city" character varying(128) NOT NULL, "province" character varying(128), "provinceCode" character varying(16), "postalCode" character varying(32), "countryCode" character varying(2) NOT NULL, "countryId" uuid, "latitude" numeric(10,6), "longitude" numeric(10,6), "isDefaultShipping" boolean NOT NULL DEFAULT false, "isDefaultBilling" boolean NOT NULL DEFAULT false, "isValidated" boolean NOT NULL DEFAULT false, "validationProviderKey" character varying(64), "ownerType" character varying(16) NOT NULL DEFAULT 'CONTACT', "ownerId" uuid NOT NULL, "customerId" uuid, "metadata" jsonb${customer}${country}, CONSTRAINT "PK_address_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_address_created_by_user" ON "address" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_updated_by_user" ON "address" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_deleted_by_user" ON "address" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_is_active" ON "address" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_is_archived" ON "address" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_tenant" ON "address" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_organization" ON "address" ("organizationId")`);
			// The party's book, which is the read a contact expansion performs.
			await queryRunner.query(
				`CREATE INDEX "IDX_address_customer" ON "address" ("customerId") WHERE "deletedAt" IS NULL`
			);
			// The same book inside one organization, which is how every party-facing list is scoped.
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_customer" ON "address" ("organizationId", "customerId") WHERE "deletedAt" IS NULL`
			);
			// The tax and shipping lookup: which addresses of this organization sit in one
			// country and postal area, which is the narrowing a rate resolution starts from.
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_country_zip" ON "address" ("organizationId", "countryCode", "postalCode") WHERE "deletedAt" IS NULL`
			);
			// The owner dimension's own read: every address of one warehouse, seller, supplier or
			// organization, whatever kind of thing it turned out to be.
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_owner" ON "address" ("organizationId", "ownerType", "ownerId") WHERE "deletedAt" IS NULL`
			);
			// At most one default shipping address per party, among live rows. The index is what makes
			// the rule a database guarantee on this dialect; the party's own column is its authority.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_default_shipping" ON "address" ("customerId") WHERE "isDefaultShipping" = true AND "deletedAt" IS NULL`
			);
			// The billing counterpart, on the same terms.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_default_billing" ON "address" ("customerId") WHERE "isDefaultBilling" = true AND "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The table and its indexes go together: the table owns the indexes and every constraint this
		// migration created. Nothing else in this file outlives it.
		await queryRunner.query(`DROP TABLE IF EXISTS "address"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports a filtered index, so both predicates the schema states are created as written.
	 * It cannot add a foreign key to an existing table, which is why both references are declared
	 * inline here, guarded by the presence of their target exactly as the other dialects guard them.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('address'))) {
			const customer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_address_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT "FK_address_country" FOREIGN KEY ("countryId") REFERENCES "country" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "address" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "label" varchar(64), "contactName" varchar(255), "company" varchar(255), "firstName" varchar(128), "lastName" varchar(128), "phone" varchar(32), "email" varchar(255), "line1" varchar(255) NOT NULL, "line2" varchar(255), "city" varchar(128) NOT NULL, "province" varchar(128), "provinceCode" varchar(16), "postalCode" varchar(32), "countryCode" varchar(2) NOT NULL, "countryId" varchar, "latitude" numeric(10,6), "longitude" numeric(10,6), "isDefaultShipping" boolean NOT NULL DEFAULT (0), "isDefaultBilling" boolean NOT NULL DEFAULT (0), "isValidated" boolean NOT NULL DEFAULT (0), "validationProviderKey" varchar(64), "ownerType" varchar(16) NOT NULL DEFAULT ('CONTACT'), "ownerId" varchar NOT NULL, "customerId" varchar, "metadata" text${customer}${country})`
			);
			await queryRunner.query(`CREATE INDEX "IDX_address_created_by_user" ON "address" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_updated_by_user" ON "address" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_deleted_by_user" ON "address" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_is_active" ON "address" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_is_archived" ON "address" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_tenant" ON "address" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_address_organization" ON "address" ("organizationId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_customer" ON "address" ("customerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_customer" ON "address" ("organizationId", "customerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_country_zip" ON "address" ("organizationId", "countryCode", "postalCode") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_address_org_owner" ON "address" ("organizationId", "ownerType", "ownerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_default_shipping" ON "address" ("customerId") WHERE "isDefaultShipping" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_address_default_billing" ON "address" ("customerId") WHERE "isDefaultBilling" = true AND "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "address"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index. The two uniqueness rules this table carries are guarded by a
	 * **boolean**, for which the generated-column form of the conventions chapter does not exist and
	 * would in any case mean something else — see the class note — so this dialect gets **no index for
	 * either** and `AddressService` is their enforcement, inside the writing transaction, with the
	 * nightly schema audit as the safety net. The four domain indexes are lookup narrowings rather than
	 * uniqueness rules, so they are created here without their predicate.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('address'))) {
			const customer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_address_customer` FOREIGN KEY (`customerId`) REFERENCES `organization_contact`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT `FK_address_country` FOREIGN KEY (`countryId`) REFERENCES `country`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`address\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`label\` varchar(64) NULL, \`contactName\` varchar(255) NULL, \`company\` varchar(255) NULL, \`firstName\` varchar(128) NULL, \`lastName\` varchar(128) NULL, \`phone\` varchar(32) NULL, \`email\` varchar(255) NULL, \`line1\` varchar(255) NOT NULL, \`line2\` varchar(255) NULL, \`city\` varchar(128) NOT NULL, \`province\` varchar(128) NULL, \`provinceCode\` varchar(16) NULL, \`postalCode\` varchar(32) NULL, \`countryCode\` varchar(2) NOT NULL, \`countryId\` varchar(36) NULL, \`latitude\` decimal(10,6) NULL, \`longitude\` decimal(10,6) NULL, \`isDefaultShipping\` tinyint NOT NULL DEFAULT 0, \`isDefaultBilling\` tinyint NOT NULL DEFAULT 0, \`isValidated\` tinyint NOT NULL DEFAULT 0, \`validationProviderKey\` varchar(64) NULL, \`ownerType\` varchar(16) NOT NULL DEFAULT 'CONTACT', \`ownerId\` varchar(36) NOT NULL, \`customerId\` varchar(36) NULL, \`metadata\` json NULL, INDEX \`IDX_address_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_address_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_address_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_address_is_active\` (\`isActive\`), INDEX \`IDX_address_is_archived\` (\`isArchived\`), INDEX \`IDX_address_tenant\` (\`tenantId\`), INDEX \`IDX_address_organization\` (\`organizationId\`), INDEX \`IDX_address_customer\` (\`customerId\`), INDEX \`IDX_address_org_customer\` (\`organizationId\`, \`customerId\`), INDEX \`IDX_address_org_country_zip\` (\`organizationId\`, \`countryCode\`, \`postalCode\`), INDEX \`IDX_address_org_owner\` (\`organizationId\`, \`ownerType\`, \`ownerId\`)${customer}${country}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`address\``);
	}
}
