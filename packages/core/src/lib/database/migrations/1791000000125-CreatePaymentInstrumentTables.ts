import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the stored-instrument model: the payer the platform remembers, and the instruments saved
 * against it.
 *
 * **Why two tables are a kernel concern.** Everything else in the delivered system already assumes they
 * exist. A charge attempt carries the instrument it was made with, a subscription carries the account
 * and the instrument a renewal charges, and the payment capability's own migration adds the constraint
 * from both tables to the provider registry. What was missing is the two rows all of that names: a
 * table answering "which account at the provider does this party charge against", and a table answering
 * "which saved instruments belong to that account". Without them a payment can be taken but not
 * remembered, and every renewal with nobody present has to ask the buyer for a second handshake.
 *
 * **The registration is provider infrastructure, not a buying-transaction concept.** An invoice settled
 * by a recurring debit, a recurring service charge, a point-of-sale sale and a marketplace payout are
 * four different domains asking the identical question, so the tables live in the kernel beside the
 * rest of the provider-facing model rather than in the capability that happens to write them first.
 *
 * **Both tables store no instrument data.** There is no column for a primary account number, a
 * verification value, a full bank account number or any track or chip data, and none may be added: the
 * provider's hosted vault holds the instrument and the platform holds a reference that is meaningless
 * outside a call to that provider with the tenant's own credentials. The reference is unique per
 * provider among live and non-revoked rows, so the same instrument cannot be saved twice.
 *
 * **`paymentProviderId` is created on both tables WITHOUT its foreign key.** The provider registry is
 * created by the payment capability's own set, which runs later, so the kernel creates the column and
 * that capability's `AddPaymentDomainForeignKeys` migration adds the constraint — this platform's rule
 * that a constraint is added where its target is created. A kernel migration never waits for a package
 * to be installed, and an installation that never installs the capability still gets the column; the
 * provider key the row also carries is what keeps it addressable in the meantime.
 *
 * **The reference into `organization_contact` is created inline**, guarded by `hasTable`: that table is
 * a kernel table created long before this tick on every installation, and the guard is what keeps the
 * file replayable against a database that was synchronised from the entities — a state in which the
 * table may already exist with the row copied across. The reference into `address` is created the same
 * way, and only where the address table is present: the address book is delivered by another set of
 * this same kernel, and creating a foreign key to a table that does not exist fails the whole migration
 * on a fresh database.
 *
 * **Every statement is guarded by `hasTable`.** The guard is not decoration: a migration is a file an
 * installation may already have applied out of band — a development database synchronised from the
 * entities has both tables and none of this migration's history — and a second run must therefore add
 * nothing rather than fail on the first `CREATE TABLE`.
 *
 * **MySQL has no filtered index**, so the two uniqueness rules that are guarded by a nullable column or
 * by the soft-delete column alone take the documented fallback: a **stored generated key column** that
 * is `'0'` while the row is live and the row's own id once it is deleted, appended to the tuple. Live
 * rows then collide on the key and soft-deleted rows never do, which is what a `WHERE "deletedAt" IS
 * NULL` predicate accomplishes on the other two dialects. That generated column exists on MySQL only
 * and is declared by no entity.
 *
 * A third rule is guarded by a **value** that no null rule can stand in for: a provider token is unique
 * among the tokens that are not revoked, `"status" <> 'REVOKED'`. That one gets a generated key of its
 * own, `notRevokedKey`, which is the row's id once the token is revoked, so a revoked token can never
 * collide — exactly what excluding it from a partial index does. Without it the MySQL index was the
 * *stricter* of the three, refusing to re-register a token that had been revoked.
 *
 * Two further uniqueness rules are guarded by a value and have **no index at all** on MySQL: one live
 * account per party, provider and role (`"status" = 'ACTIVE'`), and one default instrument per account
 * and instrument type (`"isDefault" = true`). The same generated-key form would express both — the
 * `notRevokedKey` beside them is the proof — so this is a gap in the MySQL branch rather than a limit
 * of the dialect, and until it is closed the rules are enforced by the account-holder and instrument
 * services inside the writing transaction, the default rule under a row lock on the account, and
 * re-reported nightly by the schema audit. The remaining filtered indexes are lookup narrowings rather
 * than uniqueness rules, so MySQL gets them without their predicate.
 */
export class CreatePaymentInstrumentTables1791000000125 implements MigrationInterface {
	name = 'CreatePaymentInstrumentTables1791000000125';

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
		if (!(await queryRunner.hasTable('payment_account_holder'))) {
			// The party reference is part of the table wherever its target exists — see the class note.
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_payment_account_holder_contact" FOREIGN KEY ("contactId") REFERENCES "organization_contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "payment_account_holder" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "contactId" uuid, "paymentProviderId" uuid, "providerKey" character varying(64) NOT NULL, "externalAccountId" character varying(255), "type" character varying(16) NOT NULL DEFAULT 'CUSTOMER', "status" character varying(16) NOT NULL DEFAULT 'PENDING', "verificationStatus" character varying(16) NOT NULL DEFAULT 'UNVERIFIED', "country" character varying(2), "defaultCurrency" character varying(3), "mandateReference" character varying(255), "mandateAcceptedAt" TIMESTAMP, "metadata" jsonb${contact}, CONSTRAINT "PK_payment_account_holder_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_created_by_user" ON "payment_account_holder" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_updated_by_user" ON "payment_account_holder" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_deleted_by_user" ON "payment_account_holder" ("deletedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_is_active" ON "payment_account_holder" ("isActive")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_is_archived" ON "payment_account_holder" ("isArchived")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_tenant" ON "payment_account_holder" ("tenantId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_organization" ON "payment_account_holder" ("organizationId")`
			);
			// One holder per account at the provider. The account id is unique inside the provider's
			// namespace rather than inside one tenant, so `organizationId` is deliberately not in the
			// tuple: the same account id under two organizations is a data defect and is rejected rather
			// than tolerated.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_account_holder_provider_account" ON "payment_account_holder" ("providerKey", "externalAccountId") WHERE "externalAccountId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			// At most one live account per party, provider and role: a party may hold a buyer account and
			// a payout account with the same provider, and may hold historical closed accounts beside the
			// live one, but never two live accounts of the same kind.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_account_holder_active" ON "payment_account_holder" ("contactId", "providerKey", "type") WHERE "status" = 'ACTIVE' AND "contactId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			// The party's accounts of one provider, in the order a party-facing list reads them.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_contact" ON "payment_account_holder" ("organizationId", "contactId", "type", "status") WHERE "deletedAt" IS NULL`
			);
			// The same list where the caller knows only the kind, which is what a payout screen asks.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_org_type" ON "payment_account_holder" ("organizationId", "type", "status") WHERE "deletedAt" IS NULL`
			);
			// "Which accounts belong to this provider registration", which is the read behind the
			// constraint the payment capability adds and behind a provider-side reconciliation.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_provider" ON "payment_account_holder" ("paymentProviderId", "status") WHERE "paymentProviderId" IS NOT NULL`
			);
			// The mandate lookup: a provider's mandate reference resolves to the account it backs.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_mandate" ON "payment_account_holder" ("providerKey", "mandateReference") WHERE "mandateReference" IS NOT NULL`
			);
			// The onboarding and dispute sweep: accounts that are waiting on somebody.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_open" ON "payment_account_holder" ("status", "updatedAt") WHERE "status" IN ('PENDING', 'RESTRICTED')`
			);
		}

		if (!(await queryRunner.hasTable('payment_method_token'))) {
			// The account reference cascades: an instrument has no meaning without its account. The
			// address reference is part of the table only where the address book is present, and the
			// provider registration gets its column and no constraint — see the class note.
			const holder = (await queryRunner.hasTable('payment_account_holder'))
				? ', CONSTRAINT "FK_payment_method_token_holder" FOREIGN KEY ("accountHolderId") REFERENCES "payment_account_holder"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT "FK_payment_method_token_address" FOREIGN KEY ("billingAddressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "payment_method_token" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "accountHolderId" uuid NOT NULL, "paymentProviderId" uuid, "providerKey" character varying(64) NOT NULL, "token" character varying(255) NOT NULL, "type" character varying(16) NOT NULL DEFAULT 'CARD', "brand" character varying(64), "last4" character varying(4), "expiryMonth" integer, "expiryYear" integer, "holderName" character varying(255), "billingAddressId" uuid, "isDefault" boolean NOT NULL DEFAULT false, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "lastUsedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "metadata" jsonb${holder}${address}, CONSTRAINT "PK_payment_method_token_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_created_by_user" ON "payment_method_token" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_updated_by_user" ON "payment_method_token" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_deleted_by_user" ON "payment_method_token" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_method_token_is_active" ON "payment_method_token" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_is_archived" ON "payment_method_token" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_method_token_tenant" ON "payment_method_token" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_organization" ON "payment_method_token" ("organizationId")`
			);
			// The same provider reference cannot be saved twice while it is reusable. Revocation is the
			// only removal path there is, so the predicate excludes revoked rows rather than deleted ones
			// only: re-adding a removed instrument legitimately writes a new row.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_method_token_provider_token" ON "payment_method_token" ("providerKey", "token") WHERE "status" <> 'REVOKED' AND "deletedAt" IS NULL`
			);
			// At most one default instrument per account and instrument type. One default card beside one
			// default bank account is a legitimate configuration, which is why the type is in the tuple.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_method_token_default" ON "payment_method_token" ("accountHolderId", "type") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			// The account's instrument list, in the order a party-facing list reads it.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_holder" ON "payment_method_token" ("accountHolderId", "status", "type") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_provider" ON "payment_method_token" ("paymentProviderId") WHERE "paymentProviderId" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_address" ON "payment_method_token" ("billingAddressId") WHERE "billingAddressId" IS NOT NULL`
			);
			// The expiry sweep: card instruments whose month and year have passed. It deliberately does
			// not lead with the tenancy column, because the sweep is a global scheduled pass rather than
			// an organization-scoped read, and leading with the tenant would make it unusable.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_expiry" ON "payment_method_token" ("status", "expiryYear", "expiryMonth") WHERE "type" = 'CARD'`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The instrument table first: it carries the foreign key into the account table.
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_method_token"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_account_holder"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports a filtered index, so every predicate the schema states is created as written. It
	 * cannot add a foreign key to an existing table, which is why both references are declared inline
	 * here, guarded by the presence of their target exactly as the other dialects guard them.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('payment_account_holder'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_payment_account_holder_contact" FOREIGN KEY ("contactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "payment_account_holder" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "contactId" varchar, "paymentProviderId" varchar, "providerKey" varchar(64) NOT NULL, "externalAccountId" varchar(255), "type" varchar(16) NOT NULL DEFAULT ('CUSTOMER'), "status" varchar(16) NOT NULL DEFAULT ('PENDING'), "verificationStatus" varchar(16) NOT NULL DEFAULT ('UNVERIFIED'), "country" varchar(2), "defaultCurrency" varchar(3), "mandateReference" varchar(255), "mandateAcceptedAt" datetime, "metadata" text${contact})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_created_by_user" ON "payment_account_holder" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_updated_by_user" ON "payment_account_holder" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_deleted_by_user" ON "payment_account_holder" ("deletedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_is_active" ON "payment_account_holder" ("isActive")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_is_archived" ON "payment_account_holder" ("isArchived")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_tenant" ON "payment_account_holder" ("tenantId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_organization" ON "payment_account_holder" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_account_holder_provider_account" ON "payment_account_holder" ("providerKey", "externalAccountId") WHERE "externalAccountId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_account_holder_active" ON "payment_account_holder" ("contactId", "providerKey", "type") WHERE "status" = 'ACTIVE' AND "contactId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_contact" ON "payment_account_holder" ("organizationId", "contactId", "type", "status") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_org_type" ON "payment_account_holder" ("organizationId", "type", "status") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_provider" ON "payment_account_holder" ("paymentProviderId", "status") WHERE "paymentProviderId" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_mandate" ON "payment_account_holder" ("providerKey", "mandateReference") WHERE "mandateReference" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_account_holder_open" ON "payment_account_holder" ("status", "updatedAt") WHERE "status" IN ('PENDING', 'RESTRICTED')`
			);
		}

		if (!(await queryRunner.hasTable('payment_method_token'))) {
			const holder = (await queryRunner.hasTable('payment_account_holder'))
				? ', CONSTRAINT "FK_payment_method_token_holder" FOREIGN KEY ("accountHolderId") REFERENCES "payment_account_holder" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT "FK_payment_method_token_address" FOREIGN KEY ("billingAddressId") REFERENCES "address" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "payment_method_token" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "accountHolderId" varchar NOT NULL, "paymentProviderId" varchar, "providerKey" varchar(64) NOT NULL, "token" varchar(255) NOT NULL, "type" varchar(16) NOT NULL DEFAULT ('CARD'), "brand" varchar(64), "last4" varchar(4), "expiryMonth" integer, "expiryYear" integer, "holderName" varchar(255), "billingAddressId" varchar, "isDefault" boolean NOT NULL DEFAULT (0), "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "lastUsedAt" datetime, "revokedAt" datetime, "metadata" text${holder}${address})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_created_by_user" ON "payment_method_token" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_updated_by_user" ON "payment_method_token" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_deleted_by_user" ON "payment_method_token" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_method_token_is_active" ON "payment_method_token" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_is_archived" ON "payment_method_token" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_method_token_tenant" ON "payment_method_token" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_organization" ON "payment_method_token" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_method_token_provider_token" ON "payment_method_token" ("providerKey", "token") WHERE "status" <> 'REVOKED' AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_method_token_default" ON "payment_method_token" ("accountHolderId", "type") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_holder" ON "payment_method_token" ("accountHolderId", "status", "type") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_provider" ON "payment_method_token" ("paymentProviderId") WHERE "paymentProviderId" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_address" ON "payment_method_token" ("billingAddressId") WHERE "billingAddressId" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_method_token_expiry" ON "payment_method_token" ("status", "expiryYear", "expiryMonth") WHERE "type" = 'CARD'`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The instrument table first: it carries the foreign key into the account table.
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_method_token"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_account_holder"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the fallback of the conventions chapter is used: the two
	 * uniqueness rules that are guarded by a nullable column or by the soft-delete column alone are
	 * expressed with a **stored generated key column** that is `'0'` while the row is live and the row's
	 * own id once it is deleted, appended to the tuple. Live rows then collide on the key and deleted
	 * rows never do, which is what the other two dialects get from `WHERE "deletedAt" IS NULL`.
	 *
	 * The two rules that are guarded by a **value** — one live account per party, provider and role, and
	 * one default instrument per account and type — get **no index at all**, because no generated-column
	 * form for them exists in the supported range and neither can be a null-guarded tuple member without
	 * adding a column the entities do not need. They are enforced by the account-holder and instrument
	 * services inside the writing transaction, and re-reported nightly by the schema audit, as the schema
	 * chapter states. The remaining filtered indexes are lookup narrowings rather than uniqueness rules,
	 * so this dialect gets them without their predicate.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('payment_account_holder'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_payment_account_holder_contact` FOREIGN KEY (`contactId`) REFERENCES `organization_contact`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`payment_account_holder\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`contactId\` varchar(36) NULL, \`paymentProviderId\` varchar(36) NULL, \`providerKey\` varchar(64) NOT NULL, \`externalAccountId\` varchar(255) NULL, \`type\` varchar(16) NOT NULL DEFAULT 'CUSTOMER', \`status\` varchar(16) NOT NULL DEFAULT 'PENDING', \`verificationStatus\` varchar(16) NOT NULL DEFAULT 'UNVERIFIED', \`country\` varchar(2) NULL, \`defaultCurrency\` varchar(3) NULL, \`mandateReference\` varchar(255) NULL, \`mandateAcceptedAt\` datetime NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_account_holder_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_account_holder_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_account_holder_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_account_holder_is_active\` (\`isActive\`), INDEX \`IDX_payment_account_holder_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_account_holder_tenant\` (\`tenantId\`), INDEX \`IDX_payment_account_holder_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_payment_account_holder_provider_account\` (\`providerKey\`, \`externalAccountId\`, \`deletedKey\`), INDEX \`IDX_payment_account_holder_contact\` (\`organizationId\`, \`contactId\`, \`type\`, \`status\`), INDEX \`IDX_payment_account_holder_org_type\` (\`organizationId\`, \`type\`, \`status\`), INDEX \`IDX_payment_account_holder_provider\` (\`paymentProviderId\`, \`status\`), INDEX \`IDX_payment_account_holder_mandate\` (\`providerKey\`, \`mandateReference\`), INDEX \`IDX_payment_account_holder_open\` (\`status\`, \`updatedAt\`)${contact}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('payment_method_token'))) {
			const holder = (await queryRunner.hasTable('payment_account_holder'))
				? ', CONSTRAINT `FK_payment_method_token_holder` FOREIGN KEY (`accountHolderId`) REFERENCES `payment_account_holder`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const address = (await queryRunner.hasTable('address'))
				? ', CONSTRAINT `FK_payment_method_token_address` FOREIGN KEY (`billingAddressId`) REFERENCES `address`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`payment_method_token\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`accountHolderId\` varchar(36) NOT NULL, \`paymentProviderId\` varchar(36) NULL, \`providerKey\` varchar(64) NOT NULL, \`token\` varchar(255) NOT NULL, \`type\` varchar(16) NOT NULL DEFAULT 'CARD', \`brand\` varchar(64) NULL, \`last4\` varchar(4) NULL, \`expiryMonth\` int NULL, \`expiryYear\` int NULL, \`holderName\` varchar(255) NULL, \`billingAddressId\` varchar(36) NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`lastUsedAt\` datetime NULL, \`revokedAt\` datetime NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`notRevokedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`status\` <> 'REVOKED', '0', \`id\`)) STORED, INDEX \`IDX_payment_method_token_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_method_token_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_method_token_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_method_token_is_active\` (\`isActive\`), INDEX \`IDX_payment_method_token_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_method_token_tenant\` (\`tenantId\`), INDEX \`IDX_payment_method_token_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_payment_method_token_provider_token\` (\`providerKey\`, \`token\`, \`notRevokedKey\`, \`deletedKey\`), INDEX \`IDX_payment_method_token_holder\` (\`accountHolderId\`, \`status\`, \`type\`), INDEX \`IDX_payment_method_token_provider\` (\`paymentProviderId\`), INDEX \`IDX_payment_method_token_address\` (\`billingAddressId\`), INDEX \`IDX_payment_method_token_expiry\` (\`status\`, \`expiryYear\`, \`expiryMonth\`)${holder}${address}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The instrument table first: it carries the foreign key into the account table.
		await queryRunner.query(`DROP TABLE IF EXISTS \`payment_method_token\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`payment_account_holder\``);
	}
}
