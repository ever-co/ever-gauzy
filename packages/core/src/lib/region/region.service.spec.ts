/**
 * The commercial geography (schema chapter §3.3).
 *
 * Two rules, and the suite walks each of them: a region prices in a currency the platform knows — the
 * invariant I-26, checked at write time — and at most one region per organization is the default, with
 * the claim releasing the previous holder in the same transaction. The lifecycle and the retirement path
 * are walked with them.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The service under test is the real one, over an in-memory table that applies the `where` the
 * service states; the currency master is a double of its own, because this suite is about the region's
 * use of it and not about the master's contents.
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
	// The suite runs as Postgres so the row lock the default path takes is the statement a production
	// deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ChannelStatus } from '@gauzy/contracts';
import { Region } from './region.entity';
import { RegionService } from './region.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const REGION = 'region-1';
const OTHER_REGION = 'region-2';

type Row = Record<string, any>;

const ENTITY_TABLES = new Map<unknown, string>([[Region, 'region']]);

/** The currencies the double of the master knows, which is all this suite needs of it. */
const KNOWN_CURRENCIES = ['USD', 'EUR', 'GBP'];

/** An in-memory stand-in for the region table and the transaction manager it is written through. */
function world(seed: { regions?: Row[] } = {}) {
	const tables: Record<string, Row[]> = { region: [...(seed.regions ?? [])] };
	const locks: string[] = [];
	const statements: Array<Record<string, unknown>> = [];
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
		find: async (entity: unknown, options: any = {}) => {
			statements.push({ read: tableOf(entity), ...options.where });

			return tables[tableOf(entity)].filter((row) => matches(row, options.where));
		},
		createQueryBuilder: (entity: unknown, _alias: string) => {
			const conditions: Row[] = [];
			const builder: any = {
				where: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				andWhere: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				setLock: (mode: string) => {
					locks.push(`${tableOf(entity)}:${mode}`);

					return builder;
				},
				getOne: async () => {
					statements.push({ lockedRead: tableOf(entity) });

					return tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null;
				}
			};

			return builder;
		}
	};

	const repository = {
		manager,
		metadata: { tableName: 'region', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables.region.filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables.region.find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables.region.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save('region', row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables.region.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables.region[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};

	const currencyService = {
		find: async (options: any = {}) =>
			KNOWN_CURRENCIES.includes(options?.where?.isoCode) ? [{ isoCode: options.where.isoCode }] : []
	};

	return {
		tables,
		locks,
		statements,
		region: (id: string = REGION) => tables.region.find((row) => row.id === id),
		service: new RegionService(repository as never, {} as never, currencyService as never)
	};
}

/** One `region` row, with the fields this suite reads. */
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

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('RegionService — opening a commercial geography', () => {
	it('creates the region ACTIVE, with its code trimmed and its currency normalised', async () => {
		const store = world();

		const created = await store.service.createRegion({
			name: '  European Union  ',
			code: ' eu ',
			currency: 'eur',
			isTaxInclusive: true
		});

		expect(created.name).toBe('European Union');
		expect(created.code).toBe('eu');
		expect(created.currency).toBe('EUR');
		expect(created.isTaxInclusive).toBe(true);
		expect(created.isDefault).toBe(false);
		expect(created.status).toBe(ChannelStatus.ACTIVE);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(store.region(created.id)).toBeDefined();
	});

	it('refuses a creation with no name, no code or no currency', async () => {
		const store = world();

		expect(await refusalOf(() => store.service.createRegion({ name: ' ', code: 'eu', currency: 'EUR' }))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(await refusalOf(() => store.service.createRegion({ name: 'EU', code: ' ', currency: 'EUR' }))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(await refusalOf(() => store.service.createRegion({ name: 'EU', code: 'eu' } as never))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
	});

	it('refuses a currency the platform does not know (invariant I-26)', async () => {
		const store = world();

		expect(
			await refusalOf(() => store.service.createRegion({ name: 'EU', code: 'eu', currency: 'XYZ' }))
		).toMatch(/^VALIDATION_FAILED: REGION_CURRENCY_UNKNOWN/);
		expect(store.tables.region).toHaveLength(0);
	});

	it('refuses a code the organization already uses among its live rows', async () => {
		const store = world({ regions: [regionRow(REGION, { code: 'EU' })] });

		expect(await refusalOf(() => store.service.createRegion({ name: 'EU', code: 'EU', currency: 'EUR' }))).toMatch(
			/^UNIQUE_CONSTRAINT_VIOLATION/
		);
	});
});

describe('RegionService — the currency check is a rule about the stored value (I-26)', () => {
	it('normalises the code it accepts and reports it', async () => {
		const store = world();

		await expect(store.service.assertKnownCurrency(' gbp ')).resolves.toBe('GBP');
	});

	it('refuses a blank code and an unknown one', async () => {
		const store = world();

		expect(await refusalOf(() => store.service.assertKnownCurrency('  '))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(await refusalOf(() => store.service.assertKnownCurrency('XYZ'))).toMatch(
			/^VALIDATION_FAILED: REGION_CURRENCY_UNKNOWN/
		);
	});

	it('re-checks the currency on an update, because the rule is about the value that ends up stored', async () => {
		const store = world({ regions: [regionRow(REGION, { currency: 'USD' })] });

		expect(await refusalOf(() => store.service.updateRegion(REGION, { currency: 'XYZ' }))).toMatch(
			/^VALIDATION_FAILED: REGION_CURRENCY_UNKNOWN/
		);
		expect(store.region()?.currency).toBe('USD');

		await store.service.updateRegion(REGION, { currency: 'gbp' });

		expect(store.region()?.currency).toBe('GBP');
	});

	it('refuses a code another live region already holds, and applies the rest of the update', async () => {
		const store = world({
			regions: [regionRow(REGION, { code: 'EU' }), regionRow(OTHER_REGION, { code: 'US' })]
		});

		expect(await refusalOf(() => store.service.updateRegion(REGION, { code: 'US' }))).toMatch(
			/^UNIQUE_CONSTRAINT_VIOLATION/
		);

		await store.service.updateRegion(REGION, { name: 'Eurozone', taxProviderKey: 'eu-vat' });

		expect(store.region()?.name).toBe('Eurozone');
		expect(store.region()?.taxProviderKey).toBe('eu-vat');
	});
});

describe('RegionService — the default region, and the lifecycle', () => {
	it('claims the flag and releases it from the previous holder in one transaction', async () => {
		const store = world({
			regions: [regionRow(REGION, { isDefault: true }), regionRow(OTHER_REGION)]
		});

		await store.service.setDefaultRegion(OTHER_REGION);

		expect(store.region(OTHER_REGION)?.isDefault).toBe(true);
		expect(store.region(REGION)?.isDefault).toBe(false);
		expect(store.locks).toContain('region:pessimistic_write');
	});

	it('finds the organization default and answers null when there is none', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		expect(await store.service.findDefaultRegion()).toBeNull();

		const withDefault = world({ regions: [regionRow(REGION, { isDefault: true })] });

		expect((await withDefault.service.findDefaultRegion())?.id).toBe(REGION);
	});

	it('moves the region along its lifecycle and treats ARCHIVED as terminal', async () => {
		const store = world({ regions: [regionRow(REGION, { status: ChannelStatus.DRAFT })] });

		expect((await store.service.setRegionStatus(REGION, ChannelStatus.ACTIVE)).status).toBe(
			ChannelStatus.ACTIVE
		);
		expect((await store.service.setRegionStatus(REGION, ChannelStatus.INACTIVE)).status).toBe(
			ChannelStatus.INACTIVE
		);
		expect((await store.service.setRegionStatus(REGION, ChannelStatus.ARCHIVED)).status).toBe(
			ChannelStatus.ARCHIVED
		);

		for (const next of [ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.DRAFT]) {
			expect(await refusalOf(() => store.service.setRegionStatus(REGION, next))).toMatch(
				/^PRECONDITION_REQUIRED: REGION_STATUS_INVALID/
			);
		}

		expect(await refusalOf(() => store.service.setRegionStatus(REGION, 'LIVE' as never))).toMatch(
			/^VALIDATION_INVALID_ENUM/
		);
	});

	it('retires a region without deleting it, and is idempotent', async () => {
		const store = world({ regions: [regionRow(REGION)] });

		const archived = await store.service.archiveRegion(REGION);

		expect(archived.status).toBe(ChannelStatus.ARCHIVED);
		expect(archived.isArchived).toBe(true);
		expect(store.region()?.archivedAt).toBeInstanceOf(Date);

		expect((await store.service.archiveRegion(REGION)).status).toBe(ChannelStatus.ARCHIVED);
	});
});

describe('RegionService — scoping and the list', () => {
	it('scopes every read to the caller, so a region of another organization is not found', async () => {
		const store = world({ regions: [regionRow(REGION, { organizationId: 'another-org' })] });

		expect(await store.service.findRegion(REGION)).toBeNull();
		expect(await refusalOf(() => store.service.findRegionOrFail(REGION))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_NOT_FOUND/
		);
	});

	it('answers null for a missing region and refuses an identifier it must honour', async () => {
		const store = world();

		expect(await store.service.findRegion('missing')).toBeNull();
		expect(await refusalOf(() => store.service.findRegionOrFail('missing'))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_NOT_FOUND/
		);
	});

	it('narrows the list by status, currency and code', async () => {
		const store = world({
			regions: [
				regionRow(REGION, { code: 'EU', currency: 'EUR' }),
				regionRow(OTHER_REGION, { code: 'US', currency: 'USD', status: ChannelStatus.INACTIVE })
			]
		});

		expect((await store.service.listRegions({ currency: 'EUR' })).map((one) => one.id)).toEqual([REGION]);
		expect((await store.service.listRegions({ status: ChannelStatus.INACTIVE })).map((one) => one.id)).toEqual([
			OTHER_REGION
		]);
		expect((await store.service.listRegions({ code: 'US' })).map((one) => one.id)).toEqual([OTHER_REGION]);
		expect(await store.service.listRegions()).toHaveLength(2);
	});
});
