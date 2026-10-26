// The series lock is a Postgres/MySQL decision; the fixture is SQLite, so neither dialect is configured.
jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return { ...actual, isPostgres: () => false, isMySQL: () => false };
});

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { SequenceResetPolicy } from '@gauzy/contracts';
import { RequestContext } from '../context/request-context';
import { MultiORMEnum } from '../utils';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { ContactService } from '../../contact/contact.service';
import { SeedCoreDefaults1791000000520 } from '../../database/migrations/1791000000520-SeedCoreDefaults';
import { SeedSellerPayoutSequence1791000000790 } from '../../database/migrations/1791000000790-SeedSellerPayoutSequence';
import { OrganizationCreateCommand } from '../../organization/commands';
import { CommandHandlers } from '../../organization/commands/handlers';
import { OrganizationService } from '../../organization/organization.service';
import { Sequence } from '../../sequence/sequence.entity';
import { SequenceService } from '../../sequence/sequence.service';
import { UserService } from '../../user/user.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';
import { createDefaultCommerceDefaults } from './commerce-defaults.seed';

/**
 * The per-organization commerce defaults, against a real in-memory better-sqlite3 database shaped the way
 * the SQLite migrations shape the tables (columns, NOT NULLs, defaults and the unique indexes the guards
 * mirror).
 *
 * R5-05: `1791000000520-SeedCoreDefaults` writes the defaults for the organizations that exist when it
 * runs, and the fresh-install seed for the organizations it creates. `OrganizationCreateHandler` — every
 * organization a user creates after the upgrade — wrote none of them, so that organization's first order
 * failed with 404 "No numbering series is configured for ORDER" and its first purchase order with 409
 * `PURCHASE_ORDER_SEQUENCE_MISSING`.
 *
 * The first block creates an organization through the real command handlers on the CQRS bus and then
 * numbers a document from the real `SequenceService`. The second pins that the runtime path writes what the
 * migration writes, and that neither path writes anything twice.
 */

const ZERO = '00000000-0000-0000-0000-000000000000';
const TENANT = '7a0c4b1e-0000-4000-8000-000000000001';
const OTHER_TENANT = '7a0c4b1e-0000-4000-8000-000000000002';
const MIGRATED_ORG = '7a0c4b1e-0000-4000-8000-0000000000a1';
const NEW_ORG = '7a0c4b1e-0000-4000-8000-0000000000b1';

const BASE = `"deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar`;
const ORG_KEY = `COALESCE("organizationId", '${ZERO}')`;

/** The core tables, as `1791000000080`, `0085`, `0155` and the sequence migration shape them on SQLite. */
const CORE_DDL: readonly string[] = [
	`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "tenantId" varchar, "name" varchar NOT NULL, "currency" varchar NOT NULL)`,
	`CREATE TABLE "channel" (${BASE}, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "isDefault" boolean NOT NULL DEFAULT (0), "defaultCurrency" varchar(3) NOT NULL DEFAULT ('USD'), "defaultRegionId" varchar, "defaultLocale" varchar(10), "orderNumberPrefix" varchar(16), "orderNumberPadding" integer NOT NULL DEFAULT (6), "settings" text, "metadata" text)`,
	`CREATE UNIQUE INDEX "UQ_channel_org_code" ON "channel" (${ORG_KEY}, "code") WHERE "deletedAt" IS NULL`,
	`CREATE UNIQUE INDEX "UQ_channel_default" ON "channel" (${ORG_KEY}) WHERE "isDefault" = 1 AND "deletedAt" IS NULL`,
	`CREATE TABLE "region" (${BASE}, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "currency" varchar(3) NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "isTaxInclusive" boolean NOT NULL DEFAULT (0), "taxProviderKey" varchar(64), "paymentProviderKeys" text, "fulfillmentProviderKeys" text, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'), "metadata" text)`,
	`CREATE UNIQUE INDEX "UQ_region_org_code" ON "region" (${ORG_KEY}, "code") WHERE "deletedAt" IS NULL`,
	`CREATE UNIQUE INDEX "UQ_region_default" ON "region" (${ORG_KEY}) WHERE "isDefault" = 1 AND "deletedAt" IS NULL`,
	`CREATE TABLE "channel_region" (${BASE}, "channelId" varchar NOT NULL, "regionId" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_channel_region_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id"), CONSTRAINT "FK_channel_region_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id"))`,
	`CREATE UNIQUE INDEX "UQ_channel_region" ON "channel_region" ("channelId", "regionId") WHERE "deletedAt" IS NULL`,
	`CREATE UNIQUE INDEX "UQ_channel_region_default" ON "channel_region" ("channelId") WHERE "isDefault" = 1 AND "deletedAt" IS NULL`,
	`CREATE TABLE "sequence" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "prefix" varchar, "padding" integer NOT NULL DEFAULT (1), "nextValue" integer NOT NULL DEFAULT (1), "step" integer NOT NULL DEFAULT (1), "resetPolicy" varchar NOT NULL DEFAULT ('NEVER'), "lastResetAt" datetime, "description" varchar, "channelId" varchar)`,
	`CREATE UNIQUE INDEX "UQ_sequence_org_key_no_channel" ON "sequence" (${ORG_KEY}, "key") WHERE "channelId" IS NULL AND "deletedAt" IS NULL`,
	`CREATE TABLE "unit_category" (${BASE}, "code" varchar(32) NOT NULL, "name" varchar(64) NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "metadata" text)`,
	`CREATE UNIQUE INDEX "UQ_unit_category_code" ON "unit_category" (${ORG_KEY}, "code") WHERE "deletedAt" IS NULL`,
	`CREATE TABLE "unit" (${BASE}, "categoryId" varchar NOT NULL, "code" varchar(32) NOT NULL, "name" varchar(64) NOT NULL, "symbol" varchar(16), "factor" numeric(24,12) NOT NULL DEFAULT (1), "isReference" boolean NOT NULL DEFAULT (0), "decimalPlaces" integer NOT NULL DEFAULT (0), "isSystem" boolean NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_unit_category" FOREIGN KEY ("categoryId") REFERENCES "unit_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
	`CREATE UNIQUE INDEX "UQ_unit_code" ON "unit" (${ORG_KEY}, "code") WHERE "deletedAt" IS NULL`,
	`CREATE TABLE "product_variant" ("id" varchar PRIMARY KEY NOT NULL, "deletedAt" datetime, "tenantId" varchar, "organizationId" varchar, "stockUnitId" varchar)`,
	`CREATE TABLE "tenant_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "name" varchar NOT NULL, "value" varchar)`,
	`CREATE TABLE "search_index_definition" (${BASE}, "entity" varchar(128) NOT NULL, "label" varchar(255) NOT NULL, "engineKey" varchar(64), "fields" text NOT NULL DEFAULT ('[]'), "defaultWeight" numeric(9,6) NOT NULL DEFAULT (1), "titleTemplate" varchar(512), "bodyTemplate" varchar(1024), "keywordFields" text, "sourceUpdatedAtField" varchar(64) NOT NULL DEFAULT ('updatedAt'), "isSystem" boolean NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "metadata" text, "status" varchar(16) NOT NULL DEFAULT ('ACTIVE'))`,
	`CREATE UNIQUE INDEX "UQ_search_index_definition_org_entity_nokey" ON "search_index_definition" (${ORG_KEY}, "entity") WHERE "engineKey" IS NULL AND "deletedAt" IS NULL`
];

/** The plugin tables (tax `1791000000140`, pricing `1791000000120`), absent when the plugin is not installed. */
const PLUGIN_DDL: readonly string[] = [
	`CREATE TABLE "tax_category" (${BASE}, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT (0), "metadata" text)`,
	`CREATE TABLE "price_preference" (${BASE}, "attribute" varchar(16) NOT NULL, "value" varchar(64) NOT NULL, "isTaxInclusive" boolean NOT NULL DEFAULT (0))`
];

/** `target` binds the schema to the real class, so `SequenceService`'s TypeORM repository resolves. */
const TypeOrmSequence = new EntitySchema<any>({
	name: 'Sequence',
	target: Sequence,
	tableName: 'sequence',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		isActive: { type: 'boolean', nullable: true, default: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		key: { type: 'varchar' },
		prefix: { type: 'varchar', nullable: true },
		padding: { type: 'int', default: 1 },
		nextValue: { type: 'int', default: 1 },
		step: { type: 'int', default: 1 },
		resetPolicy: { type: 'varchar', default: SequenceResetPolicy.NEVER },
		lastResetAt: { type: 'datetime', nullable: true },
		description: { type: 'varchar', nullable: true },
		channelId: { type: 'varchar', nullable: true }
	}
});

/** The tables a step writes, each with how a row of one organization is selected. */
const SEEDED_TABLES: ReadonlyArray<{ table: string; where: string }> = [
	{ table: 'channel', where: `"organizationId" = ?` },
	{ table: 'region', where: `"organizationId" = ?` },
	{
		table: 'channel_region',
		where: `"channelId" IN (SELECT "id" FROM "channel" WHERE "organizationId" = ?)`
	},
	{ table: 'tax_category', where: `"organizationId" = ?` },
	{ table: 'price_preference', where: `"organizationId" = ?` },
	{ table: 'unit_category', where: `"organizationId" = ?` },
	{ table: 'unit', where: `"organizationId" = ?` },
	{ table: 'tenant_setting', where: `"tenantId" = (SELECT "tenantId" FROM "organization" WHERE "id" = ?)` },
	{ table: 'sequence', where: `"organizationId" = ?` },
	{ table: 'search_index_definition', where: `"organizationId" = ?` }
];

/** Columns that identify a row or its owner rather than describe it. */
const IDENTITY_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'tenantId', 'organizationId']);

async function createDataSource(options: { plugins?: boolean } = {}): Promise<DataSource> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmSequence],
		synchronize: false,
		logging: false
	});
	await dataSource.initialize();

	for (const statement of [...CORE_DDL, ...(options.plugins === false ? [] : PLUGIN_DDL)]) {
		await dataSource.query(statement);
	}

	return dataSource;
}

async function insertOrganization(dataSource: DataSource, id: string, tenantId: string, currency: string) {
	await dataSource.query(`INSERT INTO "organization" ("id", "tenantId", "name", "currency") VALUES (?, ?, ?, ?)`, [
		id,
		tenantId,
		`Organization ${id.slice(-2)}`,
		currency
	]);
}

/** How many rows every seeded table holds, in total. */
async function rowCounts(dataSource: DataSource): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const { table } of SEEDED_TABLES) {
		const [row] = await dataSource.query(`SELECT COUNT(*) AS "n" FROM "${table}"`);
		counts[table] = Number(row.n);
	}
	return counts;
}

/**
 * Every seeded row of one organization, with ids and owners replaced by what they point at, so two
 * organizations' rows compare equal exactly when they carry the same defaults.
 */
async function seededRows(dataSource: DataSource, organizationId: string): Promise<Record<string, string[]>> {
	const labels = new Map<string, string>();
	for (const table of ['channel', 'region', 'unit_category', 'unit']) {
		for (const row of await dataSource.query(`SELECT "id", "code" FROM "${table}"`)) {
			labels.set(row.id, `${table}:${row.code}`);
		}
	}

	const rows: Record<string, string[]> = {};
	for (const { table, where } of SEEDED_TABLES) {
		const found: Array<Record<string, unknown>> = await dataSource.query(
			`SELECT * FROM "${table}" WHERE ${where}`,
			[organizationId]
		);
		rows[table] = found
			.map((row) =>
				JSON.stringify(
					Object.fromEntries(
						Object.entries(row)
							.filter(([column]) => !IDENTITY_COLUMNS.has(column))
							.map(([column, value]): [string, unknown] => [column, labels.get(value as string) ?? value])
							.sort(([a], [b]) => a.localeCompare(b))
					)
				)
			)
			.sort();
	}
	return rows;
}

describe('R5-05 — an organization created at runtime gets the commerce defaults (SQLite)', () => {
	let dataSource: DataSource;
	let moduleRef: TestingModule;
	let commandBus: CommandBus;
	let sequenceService: SequenceService;
	let organizationId: string | undefined;

	async function boot(options: { plugins?: boolean } = {}): Promise<void> {
		dataSource = await createDataSource(options);

		// The organization row is written by the service, so the fake writes it to the real database.
		let created = 0;
		const organizationService = {
			tableName: 'organization',
			create: jest.fn(async (input: { name: string; currency: string }) => {
				const id = `7a0c4b1e-0000-4000-8000-0000000000c${++created}`;
				await insertOrganization(dataSource, id, TENANT, input.currency);
				return { id, tenantId: TENANT, name: input.name, currency: input.currency };
			}),
			update: jest.fn(async () => undefined),
			findOneByIdString: jest.fn(async (id: string) => ({ id, tenantId: TENANT }))
		};

		moduleRef = await Test.createTestingModule({
			imports: [CqrsModule],
			providers: [
				...CommandHandlers,
				{ provide: getDataSourceToken(), useValue: dataSource },
				{ provide: OrganizationService, useValue: organizationService },
				{ provide: UserService, useValue: { find: jest.fn(async () => []) } },
				{ provide: UserOrganizationService, useValue: { create: jest.fn(async () => ({})) } },
				{ provide: ContactService, useValue: { create: jest.fn(async () => ({ id: 'contact' })) } },
				{ provide: ActivityLogService, useValue: {} }
			]
		}).compile();
		moduleRef.useLogger(false);
		await moduleRef.init();

		commandBus = moduleRef.get(CommandBus);

		sequenceService = new SequenceService(dataSource.getRepository(Sequence) as any, {} as any, {} as any);
		jest.spyOn(sequenceService, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'hasRole').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(() => organizationId);
	}

	async function createOrganization(): Promise<string> {
		const organization = await commandBus.execute(
			new OrganizationCreateCommand({ name: 'Created at runtime', currency: 'EUR' } as any)
		);
		organizationId = organization.id;
		return organization.id;
	}

	afterEach(async () => {
		organizationId = undefined;
		jest.restoreAllMocks();
		await moduleRef?.close();
		await dataSource?.destroy();
	});

	it('numbers the first order and the first purchase order of an organization created through the command', async () => {
		await boot();
		await createOrganization();

		await expect(sequenceService.allocate('ORDER')).resolves.toMatchObject({ formatted: 'SO-000001', value: 1 });
		await expect(sequenceService.allocate('PO')).resolves.toMatchObject({ formatted: 'PO-000001', value: 1 });
	});

	it('Q7-W3: numbers the first seller payout of an organization created through the command', async () => {
		await boot();
		await createOrganization();

		await expect(sequenceService.allocate('SELLER_PAYOUT')).resolves.toMatchObject({
			formatted: 'SP-000001',
			value: 1
		});
	});

	it('writes the default channel, region, series, tax category, price preference, units and search definitions', async () => {
		await boot();
		const id = await createOrganization();

		const [channel] = await dataSource.query(`SELECT * FROM "channel" WHERE "organizationId" = ?`, [id]);
		expect(channel).toMatchObject({ code: 'DEFAULT', isDefault: 1, defaultCurrency: 'EUR', tenantId: TENANT });

		const [region] = await dataSource.query(`SELECT * FROM "region" WHERE "organizationId" = ?`, [id]);
		expect(region).toMatchObject({ code: 'DEFAULT', isDefault: 1, currency: 'EUR', isTaxInclusive: 0 });

		await expect(
			dataSource.query(`SELECT "isDefault" FROM "channel_region" WHERE "channelId" = ? AND "regionId" = ?`, [
				channel.id,
				region.id
			])
		).resolves.toEqual([{ isDefault: 1 }]);

		const series = await dataSource.query(
			`SELECT "key" FROM "sequence" WHERE "organizationId" = ? AND "channelId" IS NULL ORDER BY "key"`,
			[id]
		);
		expect(series.map((row: { key: string }) => row.key)).toEqual([
			'CLAIM',
			'ENTITLEMENT',
			'EXCHANGE',
			'ORDER',
			'PO',
			'RETURN',
			'SELLER_PAYOUT',
			'SUBSCRIPTION'
		]);

		await expect(
			dataSource.query(`SELECT "code", "isDefault" FROM "tax_category" WHERE "organizationId" = ?`, [id])
		).resolves.toEqual([{ code: 'DEFAULT', isDefault: 1 }]);
		await expect(
			dataSource.query(`SELECT "attribute", "value" FROM "price_preference" WHERE "organizationId" = ?`, [id])
		).resolves.toEqual([{ attribute: 'CURRENCY', value: 'EUR' }]);

		const counts = await rowCounts(dataSource);
		expect(counts).toMatchObject({ unit_category: 6, unit: 6, tenant_setting: 3, search_index_definition: 11 });
	});

	it('still creates the organization and its core defaults when the tax and pricing plugins are not installed', async () => {
		await boot({ plugins: false });
		await createOrganization();

		await expect(sequenceService.allocate('ORDER')).resolves.toMatchObject({ formatted: 'SO-000001' });
		expect(await dataSource.query(`SELECT COUNT(*) AS "n" FROM "channel"`)).toEqual([{ n: 1 }]);
	});

	it('control: an organization nobody seeded has no ORDER series (the 404 R5-05 reported)', async () => {
		await boot();
		organizationId = NEW_ORG;
		await insertOrganization(dataSource, NEW_ORG, TENANT, 'EUR');

		await expect(sequenceService.allocate('ORDER')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('createDefaultCommerceDefaults — agreement with 1791000000520 + 1791000000790 and idempotence (SQLite)', () => {
	let dataSource: DataSource;
	// An upgraded installation runs every seed migration in order: the seven series of 0520, then 0790's
	// SELLER_PAYOUT (Q7-W3). A new organization gets all eight from the runtime seed.
	const migrations = [new SeedCoreDefaults1791000000520(), new SeedSellerPayoutSequence1791000000790()];

	async function runMigration(): Promise<void> {
		const queryRunner = dataSource.createQueryRunner();
		try {
			for (const migration of migrations) {
				await migration.up(queryRunner);
			}
		} finally {
			await queryRunner.release();
		}
	}

	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		dataSource = await createDataSource();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	it('writes for an organization created after the migration exactly the rows the migration wrote for one before it', async () => {
		await insertOrganization(dataSource, MIGRATED_ORG, TENANT, 'EUR');
		await runMigration();

		await insertOrganization(dataSource, NEW_ORG, OTHER_TENANT, 'EUR');
		await createDefaultCommerceDefaults(dataSource, [{ id: NEW_ORG }]);

		const migrated = await seededRows(dataSource, MIGRATED_ORG);
		const created = await seededRows(dataSource, NEW_ORG);

		for (const { table } of SEEDED_TABLES) {
			expect({ table, rows: migrated[table].length > 0 }).toEqual({ table, rows: true });
		}
		expect(created).toEqual(migrated);
	});

	it('writes nothing for an organization the migration already seeded', async () => {
		await insertOrganization(dataSource, MIGRATED_ORG, TENANT, 'EUR');
		await runMigration();
		const before = await rowCounts(dataSource);

		await createDefaultCommerceDefaults(dataSource, [{ id: MIGRATED_ORG }]);

		expect(await rowCounts(dataSource)).toEqual(before);
	});

	it('writes nothing the second time it runs (a re-seed, or the seed and the runtime path both reaching one organization)', async () => {
		await insertOrganization(dataSource, NEW_ORG, TENANT, 'USD');
		await createDefaultCommerceDefaults(dataSource, [{ id: NEW_ORG }, { id: NEW_ORG }]);
		const before = await rowCounts(dataSource);

		await createDefaultCommerceDefaults(dataSource, [{ id: NEW_ORG }]);

		expect(await rowCounts(dataSource)).toEqual(before);
		expect(before).toMatchObject({ channel: 1, region: 1, channel_region: 1, sequence: 8, tax_category: 1 });
	});

	it('keeps an administrator’s renumbered ORDER series instead of adding a second one', async () => {
		await insertOrganization(dataSource, NEW_ORG, TENANT, 'USD');
		await createDefaultCommerceDefaults(dataSource, [{ id: NEW_ORG }]);
		await dataSource.query(`UPDATE "sequence" SET "prefix" = 'WEB-', "nextValue" = 42 WHERE "key" = 'ORDER'`);

		await createDefaultCommerceDefaults(dataSource, [{ id: NEW_ORG }]);

		await expect(
			dataSource.query(`SELECT "prefix", "nextValue" FROM "sequence" WHERE "key" = 'ORDER'`)
		).resolves.toEqual([{ prefix: 'WEB-', nextValue: 42 }]);
	});
});
