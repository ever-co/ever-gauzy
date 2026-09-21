import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the multi-channel, multi-region kernel: the sales context, the hostnames that resolve to it,
 * the commercial geography, and the two pivots that bind them.
 *
 * **Why five tables and why they are kernel tables.** Fourteen columns of already-delivered tables name
 * a channel and six more name a region — a tenant setting, a party's contact row, a numbering series, a
 * webhook subscription, a collection's publication, a product's and a variant's publication, a price
 * list, a channel-warehouse assignment, an order, a cart, a pick wave, and on the region side a price
 * list, a tax rate, an order, a cart, a tax regime and a shipping option. Not one of those tables could
 * be given its constraint, because the table it names did not exist: every foreign key onto `channel` or
 * `region` in the delivered migrations is written **guarded** — the constraint is added only when the
 * target table is already there — so on every installation those constraints silently skipped
 * themselves and the graph the schema describes was never real. This file creates the five rows all of
 * that names, and the companion migration `AddChannelAndRegionForeignKeys1791000000530` adds the
 * constraints the guards skipped.
 *
 * The tables are kernel rather than commerce for the placement test the schema chapter states: an HRM
 * record is scoped to a legal entity and a channel, an invoice is numbered by a series that belongs to
 * a channel, an accounting report groups by region, and a tax rate, a price list and a stock location
 * are all read *for* a channel and a region by domains that are not commerce at all. A table one plugin
 * owned would have to be redeclared by the next.
 *
 * **Why this tick.** Migrations run in filename-timestamp order, and a migration may only name a table
 * that an *earlier* migration creates — the rule is enforced by `tools/scripts/plugin-contract-check.mjs`
 * and it is what makes a first clean install work. The earliest migration in the tree that carries a
 * constraint onto `channel` is `1791000000100-CreateCatalogTables`, so the five tables have to exist
 * before it; `1791000000085` is free, it runs after the core kernel set that ends at `1791000000080`,
 * and it precedes every referencing migration in the tree. The companion that activates the guards runs
 * late (`1791000000530`) on purpose: it has to be able to see every table it constrains, and a
 * constraint may be added to a table that already exists on an installation that has been running.
 *
 * **What each table carries.**
 *
 * - `region` — one commercial geography: a currency, a tax-inclusivity default, the provider keys
 *   enabled for it, and a lifecycle sharing the channel's vocabulary.
 * - `channel` — one sales context: a stable code, a default currency, an optional default region, the
 *   locale and order-numbering preferences a request resolves through, and a settings document the
 *   checkout, tax and fulfilment strategies read.
 * - `channel_domain` — hostname → channel resolution, which is the one indexed read a request does
 *   before any other guard runs.
 * - `region_country` — which countries a region serves, whether sales into each are exempt, and an
 *   optional province scope.
 * - `channel_region` — which regions a channel may sell into, and which of them it falls back to.
 *
 * **Order of creation.** `region` is created before `channel`, because `channel.defaultRegionId` names
 * it and the constraint is declared inline; the two are peers otherwise, since the channel↔region
 * relation is carried by the `channel_region` pivot in both directions and not by a column on either
 * side. `down` drops in the exact reverse of that order.
 *
 * **Every statement is guarded by `hasTable`.** A migration is a file an installation may already have
 * applied out of band — a development database synchronised from the entities has the tables and none of
 * this file's history — so a second run must add nothing rather than fail on the first `CREATE TABLE`.
 * The one reference into the country master is guarded the same way, and for the same reason: the master
 * is a kernel table delivered long before this tick, but a database synchronised from the entities may
 * legitimately not carry it, and creating a constraint onto a table that is absent fails the whole
 * migration.
 *
 * **MySQL has no filtered index**, so four of this file's uniqueness rules take the documented fallbacks
 * on that dialect:
 *
 * - the rules guarded by `"deletedAt" IS NULL` (`UQ_channel_org_code`, `UQ_region_org_code`,
 *   `UQ_channel_domain_hostname`, `UQ_region_country`, `UQ_channel_region`) take the **generated key
 *   column** form — a stored `deletedKey` that is `'0'` while the row is live and the row's own id once
 *   it is deleted, appended to the tuple, so live rows collide on the key and deleted rows never do;
 * - the rules guarded by a **boolean** (`UQ_channel_default`, `UQ_region_default`,
 *   `UQ_channel_domain_primary`, `UQ_channel_region_default`) take the form the schema chapter
 *   prescribes for exactly this case — a stored `isDefaultKey` / `isPrimaryKey` that is `1` while the row
 *   is the live default and `NULL` otherwise, kept as a nullable member of the unique tuple so that every
 *   non-default row is distinct. The predicate includes the soft-delete column, so a deleted default
 *   releases the key it held.
 *
 * A third shape sits beside those two and is not a MySQL matter at all: `organizationId` is nullable,
 * and no dialect compares two nulls equal, so `("organizationId", "code")` held a channel or a region
 * that belongs to no organization to no rule whatever. The scope column is therefore folded on every
 * dialect — the generated `organizationKey` here, `COALESCE("organizationId", '00000000-…')` in the
 * Postgres and SQLite index expression.
 *
 * Those generated columns exist on MySQL only, are declared by no entity, and are the documented price
 * of a filtered index on a dialect that has none. The remaining filtered indexes in this file are lookup
 * narrowings rather than uniqueness rules, so MySQL gets them without their predicate — a narrower index
 * is a performance decision, while a silently-ignored uniqueness rule would read as enforcement and not
 * be any.
 */
export class CreateChannelAndRegionTables1791000000085 implements MigrationInterface {
	name = 'CreateChannelAndRegionTables1791000000085';

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
		if (!(await queryRunner.hasTable('region'))) {
			await queryRunner.query(
				`CREATE TABLE "region" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "currency" character varying(3) NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "isTaxInclusive" boolean NOT NULL DEFAULT false, "taxProviderKey" character varying(64), "paymentProviderKeys" text, "fulfillmentProviderKeys" text, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, CONSTRAINT "PK_region_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_region_created_by_user" ON "region" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_updated_by_user" ON "region" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_deleted_by_user" ON "region" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_is_active" ON "region" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_is_archived" ON "region" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_tenant" ON "region" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_organization" ON "region" ("organizationId")`);
			// The region's business key: one code per organization among the live rows.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_org_code" ON "region" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
			);
			// At most one live default region per organization. An index states "at most one" and cannot
			// move the flag, which is why the service releases it from the previous holder in the same
			// transaction that claims it.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_default" ON "region" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000')) WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			// The organization's region list as the administration surface reads it.
			await queryRunner.query(
				`CREATE INDEX "IDX_region_org_status" ON "region" ("organizationId", "status") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('channel'))) {
			// The default region is part of the table only where its target is present. `region` is created
			// immediately above, so on a clean run it always is; the guard keeps the file replayable against
			// a database that was synchronised from the entities in a different order.
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_channel_default_region" FOREIGN KEY ("defaultRegionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "isDefault" boolean NOT NULL DEFAULT false, "defaultCurrency" character varying(3) NOT NULL DEFAULT 'USD', "defaultRegionId" uuid, "defaultLocale" character varying(10), "orderNumberPrefix" character varying(16), "orderNumberPadding" integer NOT NULL DEFAULT 6, "settings" jsonb, "metadata" jsonb${region}, CONSTRAINT "PK_channel_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_created_by_user" ON "channel" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_updated_by_user" ON "channel" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_deleted_by_user" ON "channel" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_is_active" ON "channel" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_is_archived" ON "channel" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_tenant" ON "channel" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_organization" ON "channel" ("organizationId")`);
			// The channel's business key: one code per organization among the live rows. It is written once
			// and is what a storefront URL, a seed file and an import mapping name.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_org_code" ON "channel" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
			);
			// At most one live default channel per organization — the fallback of the administration
			// surface, never of a request that failed to resolve a channel.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_default" ON "channel" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000')) WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			// The organization's channel list as the administration surface reads it.
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_org_status" ON "channel" ("organizationId", "status") WHERE "deletedAt" IS NULL`
			);
			// The referential check on the default region, and the join on read.
			await queryRunner.query(`CREATE INDEX "IDX_channel_default_region" ON "channel" ("defaultRegionId")`);
		}

		if (!(await queryRunner.hasTable('channel_domain'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT "FK_channel_domain_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel_domain" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "channelId" uuid NOT NULL, "hostname" character varying(255) NOT NULL, "isPrimary" boolean NOT NULL DEFAULT false, "isSslEnabled" boolean NOT NULL DEFAULT true, "redirectToPrimary" boolean NOT NULL DEFAULT false, "metadata" jsonb${channel}, CONSTRAINT "PK_channel_domain_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_created_by_user" ON "channel_domain" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_updated_by_user" ON "channel_domain" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_deleted_by_user" ON "channel_domain" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_is_active" ON "channel_domain" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_is_archived" ON "channel_domain" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_tenant" ON "channel_domain" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_organization" ON "channel_domain" ("organizationId")`
			);
			// One hostname resolves to one channel, across the whole deployment and not per tenant: the
			// header is global, and two tenants claiming one host would make the answer depend on read order.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_domain_hostname" ON "channel_domain" ("hostname") WHERE "deletedAt" IS NULL`
			);
			// Exactly one primary hostname per channel — the canonical host a storefront link is written
			// with, and the one the others redirect to.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_domain_primary" ON "channel_domain" ("channelId") WHERE "isPrimary" = true AND "deletedAt" IS NULL`
			);
			// The referential check on the channel, and the channel's hostname list.
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_channel" ON "channel_domain" ("channelId")`);
		}

		if (!(await queryRunner.hasTable('region_country'))) {
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_region_country_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			// The country master is a kernel table that predates this tick; the guard is what keeps the file
			// replayable against a database synchronised from the entities without it.
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT "FK_region_country_country" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "region_country" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "regionId" uuid NOT NULL, "countryId" uuid NOT NULL, "isTaxExempt" boolean NOT NULL DEFAULT false, "provinceCodes" text${region}${country}, CONSTRAINT "PK_region_country_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_created_by_user" ON "region_country" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_updated_by_user" ON "region_country" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_deleted_by_user" ON "region_country" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_is_active" ON "region_country" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_is_archived" ON "region_country" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_tenant" ON "region_country" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_organization" ON "region_country" ("organizationId")`
			);
			// One row per pair among the live rows: a soft-deleted membership must not keep the pair
			// occupied for ever, and two rows for one pair are two answers to the same question.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_country" ON "region_country" ("regionId", "countryId") WHERE "deletedAt" IS NULL`
			);
			// "Which regions serve this country", which is the direction an address is resolved in, and the
			// referential check on the country.
			await queryRunner.query(`CREATE INDEX "IDX_region_country_country" ON "region_country" ("countryId")`);
		}

		if (!(await queryRunner.hasTable('channel_region'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT "FK_channel_region_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_channel_region_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel_region" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "channelId" uuid NOT NULL, "regionId" uuid NOT NULL, "isDefault" boolean NOT NULL DEFAULT false${channel}${region}, CONSTRAINT "PK_channel_region_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_created_by_user" ON "channel_region" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_updated_by_user" ON "channel_region" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_deleted_by_user" ON "channel_region" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_is_active" ON "channel_region" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_is_archived" ON "channel_region" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_tenant" ON "channel_region" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_organization" ON "channel_region" ("organizationId")`
			);
			// A region is published to a channel once.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_region" ON "channel_region" ("channelId", "regionId") WHERE "deletedAt" IS NULL`
			);
			// At most one fallback region per channel — the region used when the channel's own default
			// region is unset.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_region_default" ON "channel_region" ("channelId") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			// "Which channels sell into this region", which is how the tax and catalogue administration
			// reads it, and the referential check on the region.
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_region" ON "channel_region" ("regionId")`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * Drops in the exact reverse of the creation order: the two pivots and the hostname table first,
	 * then the channel, then the region the channel names.
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "channel_region"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "region_country"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "channel_domain"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "channel"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "region"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports a filtered index, so every predicate the schema states is created as written, and it
	 * supports a stored generated column. It **cannot** add a foreign key to an existing table, which is
	 * why every constraint here is declared inline in its `CREATE TABLE`, guarded by the presence of its
	 * target exactly as the other dialects guard it: a fresh SQLite installation therefore gets the whole
	 * graph from this file and needs no companion migration, which is the reason
	 * `AddChannelAndRegionForeignKeys1791000000530` is a documented no-op on this dialect.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('region'))) {
			await queryRunner.query(
				`CREATE TABLE "region" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "currency" varchar(3) NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "isTaxInclusive" boolean NOT NULL DEFAULT (0), "taxProviderKey" varchar(64), "paymentProviderKeys" text, "fulfillmentProviderKeys" text, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "metadata" text)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_region_created_by_user" ON "region" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_updated_by_user" ON "region" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_deleted_by_user" ON "region" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_is_active" ON "region" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_is_archived" ON "region" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_tenant" ON "region" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_organization" ON "region" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_org_code" ON "region" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_default" ON "region" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000')) WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_org_status" ON "region" ("organizationId", "status") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('channel'))) {
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_channel_default_region" FOREIGN KEY ("defaultRegionId") REFERENCES "region" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "isDefault" boolean NOT NULL DEFAULT (0), "defaultCurrency" varchar(3) NOT NULL DEFAULT ('USD'), "defaultRegionId" varchar, "defaultLocale" varchar(10), "orderNumberPrefix" varchar(16), "orderNumberPadding" integer NOT NULL DEFAULT (6), "settings" text, "metadata" text${region})`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_created_by_user" ON "channel" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_updated_by_user" ON "channel" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_deleted_by_user" ON "channel" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_is_active" ON "channel" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_is_archived" ON "channel" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_tenant" ON "channel" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_organization" ON "channel" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_org_code" ON "channel" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_default" ON "channel" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000')) WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_org_status" ON "channel" ("organizationId", "status") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_default_region" ON "channel" ("defaultRegionId")`);
		}

		if (!(await queryRunner.hasTable('channel_domain'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT "FK_channel_domain_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel_domain" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "channelId" varchar NOT NULL, "hostname" varchar(255) NOT NULL, "isPrimary" boolean NOT NULL DEFAULT (0), "isSslEnabled" boolean NOT NULL DEFAULT (1), "redirectToPrimary" boolean NOT NULL DEFAULT (0), "metadata" text${channel})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_created_by_user" ON "channel_domain" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_updated_by_user" ON "channel_domain" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_deleted_by_user" ON "channel_domain" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_is_active" ON "channel_domain" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_is_archived" ON "channel_domain" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_tenant" ON "channel_domain" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_domain_organization" ON "channel_domain" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_domain_hostname" ON "channel_domain" ("hostname") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_domain_primary" ON "channel_domain" ("channelId") WHERE "isPrimary" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_domain_channel" ON "channel_domain" ("channelId")`);
		}

		if (!(await queryRunner.hasTable('region_country'))) {
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_region_country_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT "FK_region_country_country" FOREIGN KEY ("countryId") REFERENCES "country" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "region_country" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "regionId" varchar NOT NULL, "countryId" varchar NOT NULL, "isTaxExempt" boolean NOT NULL DEFAULT (0), "provinceCodes" text${region}${country})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_created_by_user" ON "region_country" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_updated_by_user" ON "region_country" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_deleted_by_user" ON "region_country" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_is_active" ON "region_country" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_is_archived" ON "region_country" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_tenant" ON "region_country" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_region_country_organization" ON "region_country" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_region_country" ON "region_country" ("regionId", "countryId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`CREATE INDEX "IDX_region_country_country" ON "region_country" ("countryId")`);
		}

		if (!(await queryRunner.hasTable('channel_region'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT "FK_channel_region_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT "FK_channel_region_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "channel_region" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "channelId" varchar NOT NULL, "regionId" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0)${channel}${region})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_created_by_user" ON "channel_region" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_updated_by_user" ON "channel_region" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_deleted_by_user" ON "channel_region" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_is_active" ON "channel_region" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_is_archived" ON "channel_region" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_tenant" ON "channel_region" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_channel_region_organization" ON "channel_region" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_region" ON "channel_region" ("channelId", "regionId") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_channel_region_default" ON "channel_region" ("channelId") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`CREATE INDEX "IDX_channel_region_region" ON "channel_region" ("regionId")`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "channel_region"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "region_country"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "channel_domain"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "channel"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "region"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the uniqueness rules of this file are expressed with the documented
	 * generated key columns: a stored `deletedKey` for the rules guarded by the soft-delete column, and a
	 * stored nullable `isDefaultKey` / `isPrimaryKey` for the rules guarded by a boolean. Both forms are
	 * described in the class note. The remaining filtered indexes are lookup narrowings rather than
	 * uniqueness rules, so this dialect gets them without their predicate.
	 *
	 * The generated columns exist on this dialect only and are declared by no entity.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('region'))) {
			await queryRunner.query(
				`CREATE TABLE \`region\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`currency\` varchar(3) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`isTaxInclusive\` tinyint NOT NULL DEFAULT 0, \`taxProviderKey\` varchar(64) NULL, \`paymentProviderKeys\` text NULL, \`fulfillmentProviderKeys\` text NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isDefaultKey\` tinyint GENERATED ALWAYS AS (IF(\`isDefault\` = 1 AND \`deletedAt\` IS NULL, 1, NULL)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, INDEX \`IDX_region_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_region_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_region_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_region_is_active\` (\`isActive\`), INDEX \`IDX_region_is_archived\` (\`isArchived\`), INDEX \`IDX_region_tenant\` (\`tenantId\`), INDEX \`IDX_region_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_region_org_code\` (\`organizationKey\`, \`code\`, \`deletedKey\`), UNIQUE INDEX \`UQ_region_default\` (\`organizationKey\`, \`isDefaultKey\`), INDEX \`IDX_region_org_status\` (\`organizationId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('channel'))) {
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT `FK_channel_default_region` FOREIGN KEY (`defaultRegionId`) REFERENCES `region`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`channel\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`status\` varchar(16) NOT NULL DEFAULT 'ACTIVE', \`isDefault\` tinyint NOT NULL DEFAULT 0, \`defaultCurrency\` varchar(3) NOT NULL DEFAULT 'USD', \`defaultRegionId\` varchar(36) NULL, \`defaultLocale\` varchar(10) NULL, \`orderNumberPrefix\` varchar(16) NULL, \`orderNumberPadding\` int NOT NULL DEFAULT 6, \`settings\` json NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isDefaultKey\` tinyint GENERATED ALWAYS AS (IF(\`isDefault\` = 1 AND \`deletedAt\` IS NULL, 1, NULL)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, INDEX \`IDX_channel_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_channel_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_channel_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_channel_is_active\` (\`isActive\`), INDEX \`IDX_channel_is_archived\` (\`isArchived\`), INDEX \`IDX_channel_tenant\` (\`tenantId\`), INDEX \`IDX_channel_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_channel_org_code\` (\`organizationKey\`, \`code\`, \`deletedKey\`), UNIQUE INDEX \`UQ_channel_default\` (\`organizationKey\`, \`isDefaultKey\`), INDEX \`IDX_channel_org_status\` (\`organizationId\`, \`status\`), INDEX \`IDX_channel_default_region\` (\`defaultRegionId\`)${region}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('channel_domain'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT `FK_channel_domain_channel` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`channel_domain\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`channelId\` varchar(36) NOT NULL, \`hostname\` varchar(255) NOT NULL, \`isPrimary\` tinyint NOT NULL DEFAULT 0, \`isSslEnabled\` tinyint NOT NULL DEFAULT 1, \`redirectToPrimary\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isPrimaryKey\` tinyint GENERATED ALWAYS AS (IF(\`isPrimary\` = 1 AND \`deletedAt\` IS NULL, 1, NULL)) STORED, INDEX \`IDX_channel_domain_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_channel_domain_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_channel_domain_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_channel_domain_is_active\` (\`isActive\`), INDEX \`IDX_channel_domain_is_archived\` (\`isArchived\`), INDEX \`IDX_channel_domain_tenant\` (\`tenantId\`), INDEX \`IDX_channel_domain_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_channel_domain_hostname\` (\`hostname\`, \`deletedKey\`), UNIQUE INDEX \`UQ_channel_domain_primary\` (\`channelId\`, \`isPrimaryKey\`), INDEX \`IDX_channel_domain_channel\` (\`channelId\`)${channel}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('region_country'))) {
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT `FK_region_country_region` FOREIGN KEY (`regionId`) REFERENCES `region`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const country = (await queryRunner.hasTable('country'))
				? ', CONSTRAINT `FK_region_country_country` FOREIGN KEY (`countryId`) REFERENCES `country`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`region_country\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`regionId\` varchar(36) NOT NULL, \`countryId\` varchar(36) NOT NULL, \`isTaxExempt\` tinyint NOT NULL DEFAULT 0, \`provinceCodes\` text NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_region_country_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_region_country_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_region_country_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_region_country_is_active\` (\`isActive\`), INDEX \`IDX_region_country_is_archived\` (\`isArchived\`), INDEX \`IDX_region_country_tenant\` (\`tenantId\`), INDEX \`IDX_region_country_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_region_country\` (\`regionId\`, \`countryId\`, \`deletedKey\`), INDEX \`IDX_region_country_country\` (\`countryId\`)${region}${country}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('channel_region'))) {
			const channel = (await queryRunner.hasTable('channel'))
				? ', CONSTRAINT `FK_channel_region_channel` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';
			const region = (await queryRunner.hasTable('region'))
				? ', CONSTRAINT `FK_channel_region_region` FOREIGN KEY (`regionId`) REFERENCES `region`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`channel_region\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`channelId\` varchar(36) NOT NULL, \`regionId\` varchar(36) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isDefaultKey\` tinyint GENERATED ALWAYS AS (IF(\`isDefault\` = 1 AND \`deletedAt\` IS NULL, 1, NULL)) STORED, INDEX \`IDX_channel_region_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_channel_region_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_channel_region_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_channel_region_is_active\` (\`isActive\`), INDEX \`IDX_channel_region_is_archived\` (\`isArchived\`), INDEX \`IDX_channel_region_tenant\` (\`tenantId\`), INDEX \`IDX_channel_region_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_channel_region\` (\`channelId\`, \`regionId\`, \`deletedKey\`), UNIQUE INDEX \`UQ_channel_region_default\` (\`channelId\`, \`isDefaultKey\`), INDEX \`IDX_channel_region_region\` (\`regionId\`)${channel}${region}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`channel_region\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`region_country\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`channel_domain\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`channel\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`region\``);
	}
}
