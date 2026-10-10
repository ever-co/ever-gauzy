/**
 * Which countries a commercial geography serves (schema chapter §3.4).
 *
 * Three rules, and the suite walks each of them: one row per `(region, country)` pair among the live
 * rows, a province scope that is either absent or a non-empty list and never an empty one, and a
 * membership written only against a region the caller can see. The whole-set replacement — the operation
 * the administration surface offers — is walked with them, including the members it withdraws.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The services under test are the real ones, over an in-memory set of tables that applies the
 * `where` the service states.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async softDelete(id: any): Promise<any> {
			return this.typeOrmRepository.update(id, { deletedAt: new Date() });
		}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ChannelStatus } from '@gauzy/contracts';
import { Region } from '../region/region.entity';
import { RegionService } from '../region/region.service';
import { RegionCountry } from './region-country.entity';
import { RegionCountryService } from './region-country.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const REGION = 'region-1';
const OTHER_REGION = 'region-2';
const COUNTRY = 'country-1';
const OTHER_COUNTRY = 'country-2';

type Row = Record<string, any>;

const ENTITY_TABLES = new Map<unknown, string>([
	[Region, 'region'],
	[RegionCountry, 'region_country']
]);

/** An in-memory stand-in for the two tables and the transaction manager they are written through. */
function world(seed: { regions?: Row[]; countries?: Row[] } = {}) {
	const tables: Record<string, Row[]> = {
		region: [...(seed.regions ?? [])],
		region_country: [...(seed.countries ?? [])]
	};
	let sequence = 0;

	const tableOf = (entity: unknown): string => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const save = (table: string, row: Row): Row => {
		if (row.id) {
			const index = tables[table].findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables[table][index] = { ...tables[table][index], ...row };

				return tables[table][index];
			}
		}

		const created = { id: `${table}-${++sequence}`, createdAt: new Date(), ...row };

		tables[table].push(created);

		return created;
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rows: Row | Row[]) => {
			const list = Array.isArray(rows) ? rows : [rows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null
	};

	const repository = (table: string) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables[table].filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables[table].find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables[table].find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save(table, row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[table].findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	});

	const currencyService = {
		find: async (options: any = {}) => (options?.where?.isoCode === 'USD' ? [{ isoCode: 'USD' }] : [])
	};
	const regionService = new RegionService(
		repository('region') as never,
		{} as never,
		currencyService as never
	);

	return {
		tables,
		row: (regionId: string, countryId: string) =>
			tables.region_country.find((one) => one.regionId === regionId && one.countryId === countryId),
		service: new RegionCountryService(
			repository('region_country') as never,
			{} as never,
			regionService
		)
	};
}

/** One `region` row. */
const regionRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Region ${id}`,
	code: id.toUpperCase(),
	currency: 'USD',
	isDefault: false,
	isTaxInclusive: false,
	status: ChannelStatus.ACTIVE,
	...overrides
});

/** One `region_country` row. */
const membershipRow = (regionId: string, countryId: string, overrides: Row = {}): Row => ({
	id: `membership-${regionId}-${countryId}`,
	tenantId: TENANT,
	organizationId: ORG,
	regionId,
	countryId,
	isTaxExempt: false,
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('RegionCountryService — placing a country in a region', () => {
	it('writes the membership with the pair, the exemption flag and the tenancy', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		const created = await store.service.addCountry(REGION, { countryId: COUNTRY, isTaxExempt: true });

		expect(created.regionId).toBe(REGION);
		expect(created.countryId).toBe(COUNTRY);
		expect(created.isTaxExempt).toBe(true);
		expect(created.provinceCodes).toBeUndefined();
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
	});

	it('defaults the exemption to false when the caller does not state it', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect((await store.service.addCountry(REGION, { countryId: COUNTRY })).isTaxExempt).toBe(false);
	});

	it('refuses a membership with no country', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect(await refusalOf(() => store.service.addCountry(REGION, {} as never))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
	});

	it('refuses a region the caller cannot see', async () => {
		const store = world({ regions: [regionRow(REGION, { organizationId: 'another-org' })] });

		expect(await refusalOf(() => store.service.addCountry(REGION, { countryId: COUNTRY }))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_NOT_FOUND/
		);
		expect(store.tables.region_country).toHaveLength(0);
	});

	it('refuses a second row for the same pair', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY)]
		});

		expect(await refusalOf(() => store.service.addCountry(REGION, { countryId: COUNTRY }))).toMatch(
			/^UNIQUE_CONSTRAINT_VIOLATION: REGION_COUNTRY_EXISTS/
		);
		expect(store.tables.region_country).toHaveLength(1);
	});
});

describe('RegionCountryService — a province scope is absent or a non-empty list', () => {
	it('accepts an absent scope, which means the whole country', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		const created = await store.service.addCountry(REGION, { countryId: COUNTRY, provinceCodes: undefined });

		expect(created.provinceCodes).toBeUndefined();
	});

	it('accepts a non-empty list, which narrows the membership below the country', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		const created = await store.service.addCountry(REGION, { countryId: COUNTRY, provinceCodes: ['CA', 'NY'] });

		expect(created.provinceCodes).toEqual(['CA', 'NY']);
	});

	it('refuses an empty list and a blank code, on both writes', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect(
			await refusalOf(() => store.service.addCountry(REGION, { countryId: COUNTRY, provinceCodes: [] }))
		).toMatch(/^VALIDATION_FAILED: REGION_COUNTRY_PROVINCES_INVALID/);

		await store.service.addCountry(REGION, { countryId: COUNTRY });

		expect(
			await refusalOf(() => store.service.updateCountry(REGION, COUNTRY, { countryId: COUNTRY, provinceCodes: [] }))
		).toMatch(/^VALIDATION_FAILED: REGION_COUNTRY_PROVINCES_INVALID/);

		expect(
			await refusalOf(() =>
				store.service.updateCountry(REGION, COUNTRY, { countryId: COUNTRY, provinceCodes: ['  '] })
			)
		).toMatch(/^VALIDATION_FAILED: REGION_COUNTRY_PROVINCES_INVALID/);
	});
});

describe('RegionCountryService — reading and changing one membership', () => {
	it('answers the country set as the union of the membership rows, and never as a column', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY), membershipRow(REGION, OTHER_COUNTRY, { isTaxExempt: true })]
		});

		expect((await store.service.countryIds(REGION)).sort()).toEqual([COUNTRY, OTHER_COUNTRY]);
		expect(await store.service.listCountries(REGION)).toHaveLength(2);
		expect(await store.service.listCountries(OTHER_REGION)).toHaveLength(0);
	});

	it('changes the two facts of an existing membership', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY)]
		});

		const updated = await store.service.updateCountry(REGION, COUNTRY, {
			countryId: COUNTRY,
			isTaxExempt: true,
			provinceCodes: ['CA']
		});

		expect(updated.isTaxExempt).toBe(true);
		expect(updated.provinceCodes).toEqual(['CA']);
	});

	it('refuses a membership the region does not carry, and removes one it does', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY)]
		});

		expect(await refusalOf(() => store.service.updateCountry(REGION, OTHER_COUNTRY, {} as never))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_COUNTRY_NOT_FOUND/
		);

		await store.service.removeCountry(REGION, COUNTRY);

		expect(store.row(REGION, COUNTRY)?.deletedAt).toBeInstanceOf(Date);
	});
});

describe('RegionCountryService — the membership check a shipping address runs', () => {
	it('serves the countries it carries and refuses the others', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY)]
		});

		expect(await store.service.isCountryServed(REGION, COUNTRY)).toBe(true);
		expect(await store.service.isCountryServed(REGION, OTHER_COUNTRY)).toBe(false);

		await expect(store.service.assertCountryServed(REGION, COUNTRY)).resolves.toBeUndefined();
		expect(await refusalOf(() => store.service.assertCountryServed(REGION, OTHER_COUNTRY))).toMatch(
			/^VALIDATION_FAILED: REGION_COUNTRY_NOT_ALLOWED/
		);
	});

	it('scopes the membership read to the caller', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY, { organizationId: 'another-org' })]
		});

		expect(await store.service.findMembership(REGION, COUNTRY)).toBeNull();
		expect(await refusalOf(() => store.service.findMembershipOrFail(REGION, COUNTRY))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_COUNTRY_NOT_FOUND/
		);
	});
});

describe('RegionCountryService — the whole-set replacement', () => {
	it('publishes what is stated, withdraws what is left out, and keeps the pair it re-states', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY), membershipRow(REGION, OTHER_COUNTRY)]
		});

		await store.service.replaceCountries(REGION, [
			{ countryId: COUNTRY, isTaxExempt: true },
			{ countryId: 'country-3', provinceCodes: ['TX'] }
		]);

		expect(store.row(REGION, COUNTRY)?.isTaxExempt).toBe(true);
		expect(store.row(REGION, COUNTRY)?.deletedAt).toBeUndefined();
		expect(store.row(REGION, OTHER_COUNTRY)?.deletedAt).toBeInstanceOf(Date);
		expect(store.row(REGION, 'country-3')?.provinceCodes).toEqual(['TX']);
	});

	it('refuses a set that names one country twice', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect(
			await refusalOf(() =>
				store.service.replaceCountries(REGION, [{ countryId: COUNTRY }, { countryId: COUNTRY }])
			)
		).toMatch(/^UNIQUE_CONSTRAINT_VIOLATION: REGION_COUNTRY_EXISTS/);
	});

	it('refuses a member with no country, and a member with an empty province scope', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect(await refusalOf(() => store.service.replaceCountries(REGION, [{} as never]))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(
			await refusalOf(() => store.service.replaceCountries(REGION, [{ countryId: COUNTRY, provinceCodes: [] }]))
		).toMatch(/^VALIDATION_FAILED: REGION_COUNTRY_PROVINCES_INVALID/);
	});

	it('empties the set when nothing is stated, which is a legitimate state', async () => {
		const store = world({
			regions: [regionRow(REGION)],
			countries: [membershipRow(REGION, COUNTRY)]
		});

		await store.service.replaceCountries(REGION, []);

		expect(store.row(REGION, COUNTRY)?.deletedAt).toBeInstanceOf(Date);
	});
});
