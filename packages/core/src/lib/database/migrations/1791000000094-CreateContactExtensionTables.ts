import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the four party tables the commercial model hangs off `organization_contact`: the contact
 * group, the membership pivot, the customer-side credential and the company-account membership.
 *
 * **Why four tables are a kernel concern.** The party row itself — `organization_contact` — is
 * extended in place by its own set, because every commercial attribute of a party belongs on the party.
 * What these four answer is genuinely different, and each answer is asked by more than one domain:
 *
 * 1. `contact_group` — "which named set of contacts does this price list, promotion, shipping rule or
 *    payment-eligibility rule target?" A group is a platform concept before it is a commercial one: CRM
 *    curates it, pricing and promotion read it, and no single capability owns it. Static and rule-based
 *    segmentation are one table because both are "a set of parties that something can target"; the kind
 *    decides only who writes the membership.
 * 2. `contact_group_member` — the explicit membership of a static group, carrying its own window and
 *    its own provenance. It is a pivot: it has no meaning without either peer, so both references
 *    cascade. The provenance column is load-bearing rather than decorative — without it, a nightly
 *    re-evaluation of a segment would be entitled to delete a membership an operator created by hand.
 * 3. `contact_credential` — the customer-side login. A shopper is not a member of staff: giving every
 *    shopper a `user` row would put them inside the staff login, the staff role evaluation and the
 *    tenant's user count, and would make a customer indistinguishable from staff in every audit trail.
 *    The row therefore holds a hash and never a password, the single-use tokens in their hashed form
 *    and never a usable link, and no role of any kind.
 * 4. `contact_buyer` — the B2B company-account membership. A company account is an
 *    `organization_contact` that has buyer rows; the membership is a pivot rather than a second kind of
 *    party, so a person stays exactly one contact row and their company relationship is a relation
 *    instead of a duplicate record. The role and the limits live on the membership, never on a tenant
 *    `role` row: a buyer is not staff, and "one row per company and buyer" cannot be expressed by a
 *    tenant-wide role.
 *
 * **Why this tick.** `1791000000120` (pricing) and `1791000000260` (promotion) each add a constraint
 * from their own `customerGroupId` column onto `contact_group`, and a migration may only reference a
 * table an **earlier** migration creates. `1791000000094` is below both, and it is free: the delivered
 * kernel set occupies `…090`, `…095`, `…125`, `…155`–`…185`, and the runtime set occupies `…500`+. The
 * tick is therefore fixed, not chosen for taste — moving it up would turn two delivered migrations into
 * references to a table that does not exist yet on a fresh installation.
 *
 * **`priceListId` is created WITHOUT its foreign key**, and deliberately: the price list is a table the
 * pricing capability's own set creates, at a tick above this one, and a kernel migration never waits for
 * a package to be installed. This is the platform's rule that a constraint is added where its target is
 * created — here, by the companion `AddContactExtensionForeignKeys` migration, which runs after the
 * pricing set and adds the reference wherever that table has been created.
 *
 * **The references into `organization_contact` and `user` are created inline**, guarded by `hasTable`:
 * both tables are platform tables created long before this tick on every installation, and the guard is
 * what keeps the file replayable against a database that was synchronised from the entities — a state
 * in which a table may already exist with its rows and without this migration's history.
 *
 * **Every statement is guarded by `hasTable`.** A migration is a file an installation may already have
 * applied out of band, so a second run must add nothing rather than fail on the first `CREATE TABLE`.
 *
 * **MySQL has no filtered index**, so the four uniqueness rules that are guarded by `deletedAt` alone
 * take the documented fallback: a **stored generated key column** that is `'0'` while the row is live
 * and the row's own id once it is deleted, appended to the tuple. Live rows then collide on the key and
 * soft-deleted rows never do, which is what `WHERE "deletedAt" IS NULL` accomplishes on the other two
 * dialects. The remaining filtered indexes are lookup narrowings rather than uniqueness rules, so MySQL
 * gets them without their predicate. The two uniqueness rules that are additionally guarded by a
 * **nullable column** (`contact_group.code`'s pair needs no guard, `contact_credential`'s token indexes
 * are lookups) need no second form: every dialect treats `NULL` values as distinct inside a unique key.
 */
export class CreateContactExtensionTables1791000000094 implements MigrationInterface {
	name = 'CreateContactExtensionTables1791000000094';

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
		if (!(await queryRunner.hasTable('contact_group'))) {
			// The price list reference is part of no constraint here — see the class note: the pricing
			// capability's set creates that table above this tick, and the companion migration adds the
			// foreign key where it exists.
			await queryRunner.query(
				`CREATE TABLE "contact_group" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "type" character varying(16) NOT NULL DEFAULT 'STATIC', "priceListId" uuid, "discountPercent" numeric(9,6), "isSystem" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_contact_group_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_created_by_user" ON "contact_group" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_updated_by_user" ON "contact_group" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_deleted_by_user" ON "contact_group" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_is_active" ON "contact_group" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_is_archived" ON "contact_group" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_tenant" ON "contact_group" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_organization" ON "contact_group" ("organizationId")`);
			// One group per code per organization: a code is how an integration and a rule address a
			// group, so a second live one would make a price list resolve to whichever row was reached
			// first. Partial, because a soft-deleted row must not keep its code occupied forever.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_group_org_code" ON "contact_group" ("organizationId", "code") WHERE "deletedAt" IS NULL`
			);
			// The listing an operator's screen asks for: the groups of one kind.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_type" ON "contact_group" ("organizationId", "type") WHERE "deletedAt" IS NULL`
			);
			// "Which groups grant this price list", which is the read behind the reference the pricing
			// set adds from `price_list.customerGroupId` and behind a price-list edit that warns about
			// the groups it changes.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_price_list" ON "contact_group" ("priceListId") WHERE "priceListId" IS NOT NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_group_member'))) {
			// Both references cascade: a pivot row has no meaning without either peer, and a group that
			// is hard-deleted by a retention job must not leave memberships behind that name nothing.
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_group_member_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const group = (await queryRunner.hasTable('contact_group'))
				? ', CONSTRAINT "FK_contact_group_member_group" FOREIGN KEY ("groupId") REFERENCES "contact_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_group_member" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "customerId" uuid NOT NULL, "groupId" uuid NOT NULL, "assignedAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP, "source" character varying(16) NOT NULL DEFAULT 'MANUAL'${contact}${group}, CONSTRAINT "PK_contact_group_member_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_created_by_user" ON "contact_group_member" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_updated_by_user" ON "contact_group_member" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_deleted_by_user" ON "contact_group_member" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_member_is_active" ON "contact_group_member" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_is_archived" ON "contact_group_member" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_member_tenant" ON "contact_group_member" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_organization" ON "contact_group_member" ("organizationId")`
			);
			// One row per pair. A membership is a fact about a pair of rows and not a log, so a second
			// live row for the same pair is a defect rather than a history; re-adding a party whose
			// membership lapsed refreshes the row it already has.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_group_member" ON "contact_group_member" ("customerId", "groupId") WHERE "deletedAt" IS NULL`
			);
			// The group's member list, in the order the expiry sweep and the evaluator read it: the
			// window is the second column because every reader of this index asks about it.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_group" ON "contact_group_member" ("groupId", "expiresAt") WHERE "deletedAt" IS NULL`
			);
			// The other direction: "which groups is this party in", which is what the pricing context
			// and the segment evaluator resolve once per request.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_customer" ON "contact_group_member" ("customerId") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_credential'))) {
			// A credential has no independent life: it is removed with the party it authenticates.
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_credential_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_credential" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "customerId" uuid NOT NULL, "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "verificationToken" character varying(255), "verificationExpiresAt" TIMESTAMP, "resetToken" character varying(255), "resetExpiresAt" TIMESTAMP, "lastLoginAt" TIMESTAMP, "failedAttempts" integer NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP, "mfaSecret" character varying(255), "metadata" jsonb${contact}, CONSTRAINT "PK_contact_credential_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_created_by_user" ON "contact_credential" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_updated_by_user" ON "contact_credential" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_deleted_by_user" ON "contact_credential" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_credential_is_active" ON "contact_credential" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_is_archived" ON "contact_credential" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_credential_tenant" ON "contact_credential" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_organization" ON "contact_credential" ("organizationId")`
			);
			// One credential per party. A second live login for one contact is a second identity, which
			// is the thing this table exists to avoid.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_credential_customer" ON "contact_credential" ("customerId") WHERE "deletedAt" IS NULL`
			);
			// The login identifier is unique **per tenant**, not per organization: a login is resolved
			// before an organization is known, so an address that named two rows would leave the
			// resolver choosing one.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_credential_tenant_email" ON "contact_credential" ("tenantId", "email") WHERE "deletedAt" IS NULL`
			);
			// The two redemption lookups: a token that arrived from a message resolves to the row that
			// issued it. They are lookups and not uniqueness rules — a token is already unique by
			// construction — so the predicates are null guards rather than soft-delete guards.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_verification" ON "contact_credential" ("verificationToken") WHERE "verificationToken" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_reset" ON "contact_credential" ("resetToken") WHERE "resetToken" IS NOT NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_buyer'))) {
			// Both sides cascade: the membership has no meaning without either the account or the buyer.
			const company = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_buyer_company" FOREIGN KEY ("companyCustomerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const buyer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_buyer_buyer" FOREIGN KEY ("buyerCustomerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			// Who invited whom is history: the membership survives the inviter's account.
			const inviter = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT "FK_contact_buyer_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_buyer" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "companyCustomerId" uuid NOT NULL, "buyerCustomerId" uuid NOT NULL, "role" character varying(16) NOT NULL DEFAULT 'PURCHASER', "spendingLimit" numeric(20,6), "periodSpendingLimit" numeric(20,6), "approvalThreshold" numeric(20,6), "periodStartDay" integer, "assignedAt" TIMESTAMP, "invitedByUserId" uuid, "metadata" jsonb${company}${buyer}${inviter}, CONSTRAINT "PK_contact_buyer_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_created_by_user" ON "contact_buyer" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_updated_by_user" ON "contact_buyer" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_deleted_by_user" ON "contact_buyer" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_is_active" ON "contact_buyer" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_is_archived" ON "contact_buyer" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_tenant" ON "contact_buyer" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_organization" ON "contact_buyer" ("organizationId")`);
			// One membership per pair. The database carries the pair; the rule that a buyer belongs to at
			// most one **active** company account is a statement about the buyer's other rows and is
			// therefore decided by the service, under a lock on the company account.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_buyer" ON "contact_buyer" ("companyCustomerId", "buyerCustomerId") WHERE "deletedAt" IS NULL`
			);
			// "Which company account does this buyer belong to", which is the first question every B2B
			// authorisation asks, and the read the one-active-account rule is decided from.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_buyer_buyer" ON "contact_buyer" ("buyerCustomerId") WHERE "deletedAt" IS NULL`
			);
			// The account's buyer list, live members first: the activity flag is in the tuple rather than
			// in a second index, because every read of this index asks about it.
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_buyer_company" ON "contact_buyer" ("companyCustomerId", "isActive") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Reverse dependency order: the two children that reference the group go before it, and every
		// table that references the party goes before nothing, because the party is not this file's.
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_buyer"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_credential"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_group_member"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_group"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports a filtered index, so every predicate the schema states is created as written. It
	 * cannot add a foreign key to an existing table, which is why every reference that has a target at
	 * this tick is declared inline here.
	 *
	 * The price list reference is the exception, and it is a real one: `price_list` is created by the
	 * pricing set at a tick **above** this one, so no statement in this file may name it. On the other
	 * two dialects the companion `AddContactExtensionForeignKeys` migration adds that constraint once
	 * the table exists; SQLite cannot add a constraint to an existing table at all, so there the rule is
	 * the service check plus the nightly schema audit — the same fallback the conventions chapter states
	 * for every constraint this dialect cannot carry. The reverse reference, from
	 * `price_list.customerGroupId` onto `contact_group`, **is** inline in the pricing set's own
	 * `CREATE TABLE`, and a fresh installation gets it there because this migration created the group
	 * first.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('contact_group'))) {
			await queryRunner.query(
				`CREATE TABLE "contact_group" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "type" varchar(16) NOT NULL DEFAULT ('STATIC'), "priceListId" varchar, "discountPercent" numeric(9,6), "isSystem" boolean NOT NULL DEFAULT (0), "metadata" text)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_created_by_user" ON "contact_group" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_updated_by_user" ON "contact_group" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_deleted_by_user" ON "contact_group" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_is_active" ON "contact_group" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_is_archived" ON "contact_group" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_tenant" ON "contact_group" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_organization" ON "contact_group" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_group_org_code" ON "contact_group" ("organizationId", "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_type" ON "contact_group" ("organizationId", "type") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_price_list" ON "contact_group" ("priceListId") WHERE "priceListId" IS NOT NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_group_member'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_group_member_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const group = (await queryRunner.hasTable('contact_group'))
				? ', CONSTRAINT "FK_contact_group_member_group" FOREIGN KEY ("groupId") REFERENCES "contact_group" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_group_member" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "customerId" varchar NOT NULL, "groupId" varchar NOT NULL, "assignedAt" datetime NOT NULL DEFAULT (datetime('now')), "expiresAt" datetime, "source" varchar(16) NOT NULL DEFAULT ('MANUAL')${contact}${group})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_created_by_user" ON "contact_group_member" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_updated_by_user" ON "contact_group_member" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_deleted_by_user" ON "contact_group_member" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_member_is_active" ON "contact_group_member" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_is_archived" ON "contact_group_member" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_group_member_tenant" ON "contact_group_member" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_organization" ON "contact_group_member" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_group_member" ON "contact_group_member" ("customerId", "groupId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_group" ON "contact_group_member" ("groupId", "expiresAt") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_group_member_customer" ON "contact_group_member" ("customerId") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_credential'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_credential_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_credential" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "customerId" varchar NOT NULL, "email" varchar(255) NOT NULL, "passwordHash" varchar(255) NOT NULL, "isVerified" boolean NOT NULL DEFAULT (0), "verificationToken" varchar(255), "verificationExpiresAt" datetime, "resetToken" varchar(255), "resetExpiresAt" datetime, "lastLoginAt" datetime, "failedAttempts" integer NOT NULL DEFAULT (0), "lockedUntil" datetime, "mfaSecret" varchar(255), "metadata" text${contact})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_created_by_user" ON "contact_credential" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_updated_by_user" ON "contact_credential" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_deleted_by_user" ON "contact_credential" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_credential_is_active" ON "contact_credential" ("isActive")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_is_archived" ON "contact_credential" ("isArchived")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_credential_tenant" ON "contact_credential" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_organization" ON "contact_credential" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_credential_customer" ON "contact_credential" ("customerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_credential_tenant_email" ON "contact_credential" ("tenantId", "email") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_verification" ON "contact_credential" ("verificationToken") WHERE "verificationToken" IS NOT NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_credential_reset" ON "contact_credential" ("resetToken") WHERE "resetToken" IS NOT NULL`
			);
		}

		if (!(await queryRunner.hasTable('contact_buyer'))) {
			const company = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_buyer_company" FOREIGN KEY ("companyCustomerId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const buyer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT "FK_contact_buyer_buyer" FOREIGN KEY ("buyerCustomerId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const inviter = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT "FK_contact_buyer_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "contact_buyer" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "companyCustomerId" varchar NOT NULL, "buyerCustomerId" varchar NOT NULL, "role" varchar(16) NOT NULL DEFAULT ('PURCHASER'), "spendingLimit" numeric(20,6), "periodSpendingLimit" numeric(20,6), "approvalThreshold" numeric(20,6), "periodStartDay" integer, "assignedAt" datetime, "invitedByUserId" varchar, "metadata" text${company}${buyer}${inviter})`
			);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_created_by_user" ON "contact_buyer" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_updated_by_user" ON "contact_buyer" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_deleted_by_user" ON "contact_buyer" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_is_active" ON "contact_buyer" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_is_archived" ON "contact_buyer" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_tenant" ON "contact_buyer" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_contact_buyer_organization" ON "contact_buyer" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_contact_buyer" ON "contact_buyer" ("companyCustomerId", "buyerCustomerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_buyer_buyer" ON "contact_buyer" ("buyerCustomerId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_contact_buyer_company" ON "contact_buyer" ("companyCustomerId", "isActive") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_buyer"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_credential"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_group_member"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "contact_group"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the fallback of the conventions chapter is used. The four
	 * uniqueness rules that are guarded by the soft-delete column alone take the **stored generated key
	 * column** form: `deletedKey` is `'0'` while the row is live and the row's own id once it is
	 * deleted, and it is appended to the tuple, so live rows collide on it and deleted rows never do.
	 * The remaining filtered indexes are lookup narrowings rather than uniqueness rules, so this dialect
	 * gets them without their predicate.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('contact_group'))) {
			await queryRunner.query(
				`CREATE TABLE \`contact_group\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`type\` varchar(16) NOT NULL DEFAULT 'STATIC', \`priceListId\` varchar(36) NULL, \`discountPercent\` decimal(9,6) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_contact_group_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_contact_group_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_contact_group_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_contact_group_is_active\` (\`isActive\`), INDEX \`IDX_contact_group_is_archived\` (\`isArchived\`), INDEX \`IDX_contact_group_tenant\` (\`tenantId\`), INDEX \`IDX_contact_group_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_contact_group_org_code\` (\`organizationId\`, \`code\`, \`deletedKey\`), INDEX \`IDX_contact_group_type\` (\`organizationId\`, \`type\`), INDEX \`IDX_contact_group_price_list\` (\`priceListId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('contact_group_member'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_contact_group_member_customer` FOREIGN KEY (`customerId`) REFERENCES `organization_contact`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const group = (await queryRunner.hasTable('contact_group'))
				? ', CONSTRAINT `FK_contact_group_member_group` FOREIGN KEY (`groupId`) REFERENCES `contact_group`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`contact_group_member\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`customerId\` varchar(36) NOT NULL, \`groupId\` varchar(36) NOT NULL, \`assignedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`expiresAt\` datetime NULL, \`source\` varchar(16) NOT NULL DEFAULT 'MANUAL', \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_contact_group_member_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_contact_group_member_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_contact_group_member_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_contact_group_member_is_active\` (\`isActive\`), INDEX \`IDX_contact_group_member_is_archived\` (\`isArchived\`), INDEX \`IDX_contact_group_member_tenant\` (\`tenantId\`), INDEX \`IDX_contact_group_member_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_contact_group_member\` (\`customerId\`, \`groupId\`, \`deletedKey\`), INDEX \`IDX_contact_group_member_group\` (\`groupId\`, \`expiresAt\`), INDEX \`IDX_contact_group_member_customer\` (\`customerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
			if (contact) {
				await queryRunner.query(
					`ALTER TABLE \`contact_group_member\` ADD CONSTRAINT \`FK_contact_group_member_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
			if (group) {
				await queryRunner.query(
					`ALTER TABLE \`contact_group_member\` ADD CONSTRAINT \`FK_contact_group_member_group\` FOREIGN KEY (\`groupId\`) REFERENCES \`contact_group\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
		}

		if (!(await queryRunner.hasTable('contact_credential'))) {
			const contact = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_contact_credential_customer` FOREIGN KEY (`customerId`) REFERENCES `organization_contact`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`contact_credential\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`customerId\` varchar(36) NOT NULL, \`email\` varchar(255) NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`isVerified\` tinyint NOT NULL DEFAULT 0, \`verificationToken\` varchar(255) NULL, \`verificationExpiresAt\` datetime NULL, \`resetToken\` varchar(255) NULL, \`resetExpiresAt\` datetime NULL, \`lastLoginAt\` datetime NULL, \`failedAttempts\` int NOT NULL DEFAULT 0, \`lockedUntil\` datetime NULL, \`mfaSecret\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_contact_credential_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_contact_credential_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_contact_credential_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_contact_credential_is_active\` (\`isActive\`), INDEX \`IDX_contact_credential_is_archived\` (\`isArchived\`), INDEX \`IDX_contact_credential_tenant\` (\`tenantId\`), INDEX \`IDX_contact_credential_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_contact_credential_customer\` (\`customerId\`, \`deletedKey\`), UNIQUE INDEX \`UQ_contact_credential_tenant_email\` (\`tenantId\`, \`email\`, \`deletedKey\`), INDEX \`IDX_contact_credential_verification\` (\`verificationToken\`), INDEX \`IDX_contact_credential_reset\` (\`resetToken\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
			if (contact) {
				await queryRunner.query(
					`ALTER TABLE \`contact_credential\` ADD CONSTRAINT \`FK_contact_credential_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
		}

		if (!(await queryRunner.hasTable('contact_buyer'))) {
			const company = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_contact_buyer_company` FOREIGN KEY (`companyCustomerId`) REFERENCES `organization_contact`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const buyer = (await queryRunner.hasTable('organization_contact'))
				? ', CONSTRAINT `FK_contact_buyer_buyer` FOREIGN KEY (`buyerCustomerId`) REFERENCES `organization_contact`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const inviter = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT `FK_contact_buyer_invited_by` FOREIGN KEY (`invitedByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`contact_buyer\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`companyCustomerId\` varchar(36) NOT NULL, \`buyerCustomerId\` varchar(36) NOT NULL, \`role\` varchar(16) NOT NULL DEFAULT 'PURCHASER', \`spendingLimit\` decimal(20,6) NULL, \`periodSpendingLimit\` decimal(20,6) NULL, \`approvalThreshold\` decimal(20,6) NULL, \`periodStartDay\` int NULL, \`assignedAt\` datetime NULL, \`invitedByUserId\` varchar(36) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_contact_buyer_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_contact_buyer_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_contact_buyer_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_contact_buyer_is_active\` (\`isActive\`), INDEX \`IDX_contact_buyer_is_archived\` (\`isArchived\`), INDEX \`IDX_contact_buyer_tenant\` (\`tenantId\`), INDEX \`IDX_contact_buyer_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_contact_buyer\` (\`companyCustomerId\`, \`buyerCustomerId\`, \`deletedKey\`), INDEX \`IDX_contact_buyer_buyer\` (\`buyerCustomerId\`), INDEX \`IDX_contact_buyer_company\` (\`companyCustomerId\`, \`isActive\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
			if (company) {
				await queryRunner.query(
					`ALTER TABLE \`contact_buyer\` ADD CONSTRAINT \`FK_contact_buyer_company\` FOREIGN KEY (\`companyCustomerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
			if (buyer) {
				await queryRunner.query(
					`ALTER TABLE \`contact_buyer\` ADD CONSTRAINT \`FK_contact_buyer_buyer\` FOREIGN KEY (\`buyerCustomerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
			if (inviter) {
				await queryRunner.query(
					`ALTER TABLE \`contact_buyer\` ADD CONSTRAINT \`FK_contact_buyer_invited_by\` FOREIGN KEY (\`invitedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
				);
			}
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`contact_buyer\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`contact_credential\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`contact_group_member\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`contact_group\``);
	}
}
