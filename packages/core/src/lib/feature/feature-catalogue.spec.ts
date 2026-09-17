/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules` — a counter based stub
 * keeps the ids unique (what the SQLite assertions below care about) and the module graph CommonJS.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

import { QueryRunner } from 'typeorm';
import { gauzyToggleFeatures, DatabaseTypeEnum } from '@gauzy/config';
import { FeatureEnum, IFeature } from '@gauzy/contracts';
import { COMMERCE_CATALOGUE, DEFAULT_ENABLED_FEATURES, IFeatureCatalogueEntry } from './commerce-feature-catalogue';
import { DEFAULT_FEATURES } from './default-features';
import { SeedCoreFeatures1791000000510 } from '../database/migrations/1791000000510-SeedCoreFeatures';

/**
 * The two paths a feature flag reaches a tenant through must state the same catalogue.
 *
 * On an **existing** installation `SeedCoreFeatures1791000000510` writes the `feature` rows (and an
 * enabled `feature_organization` row per live tenant for the default-on codes). On a **fresh** one
 * `createDefaultFeatureToggle` deletes both tables and recreates exactly what `DEFAULT_FEATURES`
 * lists. Two hand-maintained copies of one list drift, and this path's failure mode is silent: a code
 * the migration seeds and the fresh-install list omits is deleted again on the new database, the guard
 * resolves the flag as disabled, and no row exists for an administrator to switch on.
 *
 * The first half of this file asserts the catalogue against `DEFAULT_FEATURES`; the second drives the
 * migration through a `QueryRunner` stand-in and asserts the values it binds are the values the
 * fresh-install seed writes, code by code, on every dialect. Nothing here needs a database.
 */

/** Every entry `DEFAULT_FEATURES` holds, parents and children alike. */
const flatten = (items: IFeature[]): IFeature[] => items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

const defaultFeatures: IFeature[] = flatten(DEFAULT_FEATURES);
const byCode = new Map<string, IFeature>(defaultFeatures.map((entry) => [entry.code, entry]));

const catalogueCodes: string[] = COMMERCE_CATALOGUE.map((entry) => entry.code);
const reusedCodes: string[] = [FeatureEnum.FEATURE_PAYMENT, FeatureEnum.FEATURE_CONTACT];
const defaultOnCodes: string[] = DEFAULT_ENABLED_FEATURES.map((entry) => entry.code);

/** The metadata fields both seed paths write, in the order the migration binds them. */
const METADATA_FIELDS = ['name', 'code', 'description', 'image', 'link', 'status', 'icon'] as const;
type MetadataField = (typeof METADATA_FIELDS)[number];

const SQL_DIALECTS: DatabaseTypeEnum[] = [
	DatabaseTypeEnum.sqlite,
	DatabaseTypeEnum.betterSqlite3,
	DatabaseTypeEnum.postgres,
	DatabaseTypeEnum.mysql
];

const isSqlite = (type: DatabaseTypeEnum): boolean =>
	type === DatabaseTypeEnum.sqlite || type === DatabaseTypeEnum.betterSqlite3;

/**
 * Whether the dialect's `up()` binds the row id itself.
 *
 * Postgres is the only one that does not: it selects `gen_random_uuid()`. SQLite has no server-side
 * UUID function and MySQL's `INSERT ... SELECT ... FROM DUAL` takes the id as a parameter, so on both
 * the same fields sit one place further along.
 */
const bindsIdFirst = (type: DatabaseTypeEnum): boolean => isSqlite(type) || type === DatabaseTypeEnum.mysql;

type ExecutedQuery = { sql: string; parameters: any[] };
type BoundRow = Record<MetadataField, any>;

/**
 * Minimal `QueryRunner` stand-in: records every statement the migration issues and lets a case decide
 * what a `SELECT` returns. Enough to read back exactly what the migration binds, per dialect, without
 * a live database.
 */
const createQueryRunner = (
	type: DatabaseTypeEnum,
	onQuery: (sql: string) => any = () => []
): { queryRunner: QueryRunner; executed: ExecutedQuery[] } => {
	const executed: ExecutedQuery[] = [];
	const queryRunner = {
		connection: { options: { type } },
		dataSource: { options: { type } },
		query: jest.fn(async (sql: string, parameters: any[] = []) => {
			executed.push({ sql, parameters });
			return onQuery(sql);
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
};

/** A runner that reports one missing (tenant, feature) pair, so the SQLite path has a row to write. */
const createSeededQueryRunner = (type: DatabaseTypeEnum) =>
	createQueryRunner(type, (sql) =>
		sql.trimStart().toUpperCase().startsWith('SELECT')
			? [{ tenantId: 'tenant-uuid-1', featureId: 'feature-uuid-1' }]
			: []
	);

/** The catalogue inserts of one run: `feature`, never `feature_organization`. */
const catalogueInserts = (executed: ExecutedQuery[]): ExecutedQuery[] =>
	executed.filter(({ sql }) => /INSERT\s+INTO\s+[`"]feature[`"]\s*\(/i.test(sql));

/**
 * The catalogue row a dialect bound.
 *
 * SQLite and MySQL bind `id` first (`feature_organization.id` has no default on SQLite, and MySQL's
 * `INSERT ... SELECT ... FROM DUAL` takes it as a parameter); Postgres lets the server generate it.
 */
const boundRow = (type: DatabaseTypeEnum, parameters: any[]): BoundRow => {
	const offset = bindsIdFirst(type) ? 1 : 0;
	const [name, code, description, image, link, status, icon] = parameters.slice(offset, offset + 7);
	return { name, code, description, image, link, status, icon };
};

/**
 * The catalogue code each toggle row was written for.
 *
 * Postgres and MySQL bind the code directly. SQLite resolves the `(tenant, feature)` pairs first and
 * writes the rows one by one with an id generated in JavaScript, so a toggle's code is the parameter
 * of the `SELECT` that produced it.
 */
const toggledCodes = (type: DatabaseTypeEnum, executed: ExecutedQuery[]): string[] => {
	if (isSqlite(type)) {
		const codes: string[] = [];
		let current: string | undefined;
		for (const { sql, parameters } of executed) {
			if (/^\s*SELECT/i.test(sql)) {
				current = parameters[0];
			} else if (/INSERT\s+INTO\s+[`"]feature_organization[`"]/i.test(sql)) {
				codes.push(current);
			}
		}
		return codes;
	}
	return executed
		.filter(({ sql }) => /INSERT\s+INTO\s+[`"]feature_organization[`"]/i.test(sql))
		.map(({ parameters }) => parameters[0]);
};

describe('the commerce feature catalogue', () => {
	it('is the 32 codes the programme introduces, each exactly once', () => {
		expect(COMMERCE_CATALOGUE).toHaveLength(32);
		expect(new Set(catalogueCodes).size).toBe(32);
		catalogueCodes.forEach((code) => expect(code).toMatch(/^FEATURE_[A-Z0-9_]+$/));
	});

	it('marks exactly eight codes enabled by default', () => {
		expect([...defaultOnCodes].sort()).toEqual(
			[
				'FEATURE_CART',
				'FEATURE_CATALOG',
				'FEATURE_GRAPHQL',
				'FEATURE_INVENTORY',
				'FEATURE_ORDER',
				'FEATURE_PRICING',
				'FEATURE_PROMOTION',
				'FEATURE_TAX'
			].sort()
		);
	});

	it('has no duplicate code anywhere in DEFAULT_FEATURES', () => {
		expect(defaultFeatures).toHaveLength(byCode.size);
	});

	it.each(catalogueCodes)('states %s in DEFAULT_FEATURES with the same metadata and status', (code) => {
		const entry: IFeatureCatalogueEntry = COMMERCE_CATALOGUE.find((item) => item.code === code);
		const seeded: IFeature = byCode.get(code);

		expect(seeded).toBeDefined();
		METADATA_FIELDS.forEach((field) => expect(seeded[field]).toEqual(entry[field]));
		// the fresh-install seed writes `isEnabled` into the toggle row it creates
		expect(seeded.isEnabled).toBe(entry.defaultEnabled);
	});

	it('still takes every pre-existing entry status from the configuration map', () => {
		// additive only: an entry this change did not introduce keeps the status it had, which is
		// `gauzyToggleFeatures[code]` — the value `feature.seed.ts` has always written for it
		defaultFeatures
			.filter((entry) => !catalogueCodes.includes(entry.code))
			.forEach((entry) => expect(entry.isEnabled).toBe(gauzyToggleFeatures[entry.code]));
	});
});

describe('SeedCoreFeatures1791000000510', () => {
	let migration: SeedCoreFeatures1791000000510;

	beforeEach(() => {
		migration = new SeedCoreFeatures1791000000510();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(SQL_DIALECTS)('writes one catalogue row per catalogue code plus the reused pair on %s', async (type) => {
		const { queryRunner, executed } = createSeededQueryRunner(type);

		await migration.up(queryRunner);

		const inserts = catalogueInserts(executed);
		expect(inserts).toHaveLength(COMMERCE_CATALOGUE.length + reusedCodes.length);

		const written = inserts.map(({ parameters }) => boundRow(type, parameters).code);
		expect(new Set(written).size).toBe(written.length);
		catalogueCodes.forEach((code) => expect(written).toContain(code));
		reusedCodes.forEach((code) => expect(written).toContain(code));
	});

	it.each(SQL_DIALECTS)('binds exactly the metadata the fresh-install seed holds, on %s', async (type) => {
		const { queryRunner, executed } = createSeededQueryRunner(type);

		await migration.up(queryRunner);

		catalogueInserts(executed).forEach(({ parameters }) => {
			const row = boundRow(type, parameters);
			const seeded = byCode.get(row.code);

			expect(seeded).toBeDefined();
			METADATA_FIELDS.forEach((field) => expect(row[field]).toEqual(seeded[field]));
		});
	});

	it.each(SQL_DIALECTS)('enables a toggle for exactly the default-on catalogue codes on %s', async (type) => {
		const { queryRunner, executed } = createSeededQueryRunner(type);

		await migration.up(queryRunner);

		const toggled = toggledCodes(type, executed);
		expect([...toggled].sort()).toEqual([...defaultOnCodes].sort());
		// every code the migration switches on is a code the fresh-install seed switches on
		toggled.forEach((code) => expect(byCode.get(code).isEnabled).toBe(true));
		// the reused pair is never toggled: its setting belongs to the administrator who made it
		reusedCodes.forEach((code) => expect(toggled).not.toContain(code));
	});

	it('guards every catalogue insert with NOT EXISTS so it is re-runnable', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres);

		await migration.up(queryRunner);

		catalogueInserts(executed).forEach(({ sql }) => expect(sql).toMatch(/NOT EXISTS/i));
		executed
			.filter(({ sql }) => /INSERT\s+INTO\s+[`"]feature_organization[`"]/i.test(sql))
			.forEach(({ sql }) => {
				expect(sql).toMatch(/NOT EXISTS/i);
				// tenant scoped rows only, exactly like `feature.seed.ts` creates them
				expect(sql).toMatch(/organizationId[`"]?\s+IS NULL/i);
				expect(sql).toMatch(/deletedAt[`"]?\s+IS NULL/i);
			});
	});

	it('removes only its own rows on down', async () => {
		const { queryRunner, executed } = createQueryRunner(DatabaseTypeEnum.postgres);

		await migration.down(queryRunner);

		const deletedCodes = executed
			.filter(({ sql }) => /DELETE\s+FROM\s+"feature"\s+WHERE/i.test(sql))
			.map(({ parameters }) => parameters[0]);
		expect([...deletedCodes].sort()).toEqual([...catalogueCodes].sort());
		reusedCodes.forEach((code) => expect(deletedCodes).not.toContain(code));
	});

	it('throws for an unsupported database', async () => {
		const { queryRunner } = createQueryRunner('oracle' as DatabaseTypeEnum);
		await expect(migration.up(queryRunner)).rejects.toThrow(/Unsupported database/);
	});
});
