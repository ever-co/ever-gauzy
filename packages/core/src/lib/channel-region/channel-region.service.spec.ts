/**
 * Which regions a channel sells into (schema chapter §3.5).
 *
 * Four rules, and the suite walks each of them: a region is reachable from a channel only through a row
 * here, one row per `(channel, region)` pair among the live rows, at most one region per channel is the
 * fallback, and the channel's own default region is a member that is not withdrawn while the channel
 * still names it — invariant I-27. The whole-set replacement the administration surface offers is walked
 * with them.
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
	// The suite runs as Postgres so the row lock the fallback path takes is the statement a production
	// deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ChannelStatus } from '@gauzy/contracts';
import { Channel } from '../channel/channel.entity';
import { Region } from '../region/region.entity';
import { RegionService } from '../region/region.service';
import { ChannelRegion } from './channel-region.entity';
import { ChannelRegionService } from './channel-region.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL = 'channel-1';
const OTHER_CHANNEL = 'channel-2';
const REGION = 'region-1';
const OTHER_REGION = 'region-2';

type Row = Record<string, any>;

const ENTITY_TABLES = new Map<unknown, string>([
	[Channel, 'channel'],
	[Region, 'region'],
	[ChannelRegion, 'channel_region']
]);

/** An in-memory stand-in for the three tables and the transaction manager they are written through. */
function world(seed: { channels?: Row[]; regions?: Row[]; memberships?: Row[] } = {}) {
	const tables: Record<string, Row[]> = {
		channel: [...(seed.channels ?? [])],
		region: [...(seed.regions ?? [])],
		channel_region: [...(seed.memberships ?? [])]
	};
	const locks: string[] = [];
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
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
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
				getOne: async () =>
					tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null
			};

			return builder;
		}
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
	const regionService = new RegionService(repository('region') as never, {} as never, currencyService as never);

	return {
		tables,
		locks,
		channel: (id: string = CHANNEL) => tables.channel.find((row) => row.id === id),
		row: (channelId: string, regionId: string) =>
			tables.channel_region.find((one) => one.channelId === channelId && one.regionId === regionId),
		service: new ChannelRegionService(
			repository('channel_region') as never,
			{} as never,
			regionService,
			repository('channel') as never
		)
	};
}

/** One `channel` row. */
const channelRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Channel ${id}`,
	code: id.toUpperCase(),
	status: ChannelStatus.ACTIVE,
	isDefault: false,
	defaultCurrency: 'USD',
	orderNumberPadding: 6,
	...overrides
});

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

/** One `channel_region` row. */
const membershipRow = (channelId: string, regionId: string, overrides: Row = {}): Row => ({
	id: `membership-${channelId}-${regionId}`,
	tenantId: TENANT,
	organizationId: ORG,
	channelId,
	regionId,
	isDefault: false,
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

describe('ChannelRegionService — publishing a region to a channel', () => {
	it('writes the membership with the pair, the fallback flag and the tenancy', async () => {
		const store = world({ channels: [channelRow(CHANNEL)], regions: [regionRow(REGION)] });

		const created = await store.service.publishRegion(CHANNEL, REGION);

		expect(created.channelId).toBe(CHANNEL);
		expect(created.regionId).toBe(REGION);
		expect(created.isDefault).toBe(false);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
	});

	it('refuses a channel or a region the caller cannot see', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION, { organizationId: 'another-org' })]
		});

		expect(await refusalOf(() => store.service.publishRegion(OTHER_CHANNEL, REGION))).toMatch(
			/^RESOURCE_NOT_FOUND: CHANNEL_NOT_FOUND/
		);
		expect(await refusalOf(() => store.service.publishRegion(CHANNEL, REGION))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_NOT_FOUND/
		);
		expect(store.tables.channel_region).toHaveLength(0);
	});

	it('refuses a region already published to the channel', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		expect(await refusalOf(() => store.service.publishRegion(CHANNEL, REGION))).toMatch(
			/^UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_REGION_EXISTS/
		);
		expect(store.tables.channel_region).toHaveLength(1);
	});

	it('claims the fallback flag in the same call when it is asked for', async () => {
		const store = world({ channels: [channelRow(CHANNEL)], regions: [regionRow(REGION)] });

		const created = await store.service.publishRegion(CHANNEL, REGION, { isDefault: true });

		expect(created.isDefault).toBe(true);
		expect(store.row(CHANNEL, REGION)?.isDefault).toBe(true);
	});
});

describe('ChannelRegionService — the check a channel-scoped request runs', () => {
	it('enables the regions it carries and refuses the others', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		expect(await store.service.isRegionEnabled(CHANNEL, REGION)).toBe(true);
		expect(await store.service.isRegionEnabled(CHANNEL, OTHER_REGION)).toBe(false);
		expect(await store.service.isRegionEnabled(OTHER_CHANNEL, REGION)).toBe(false);

		await expect(store.service.assertRegionEnabled(CHANNEL, REGION)).resolves.toBeUndefined();
		expect(await refusalOf(() => store.service.assertRegionEnabled(CHANNEL, OTHER_REGION))).toMatch(
			/^VALIDATION_FAILED: REGION_NOT_SUPPORTED_FOR_CHANNEL/
		);
	});

	it('lists the published regions with the fallback first', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [membershipRow(CHANNEL, REGION), membershipRow(CHANNEL, OTHER_REGION, { isDefault: true })]
		});

		expect((await store.service.listRegions(CHANNEL)).map((one) => one.regionId)).toEqual([
			OTHER_REGION,
			REGION
		]);
	});

	it('scopes the membership read to the caller', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)],
			memberships: [membershipRow(CHANNEL, REGION, { organizationId: 'another-org' })]
		});

		expect(await store.service.findMembership(CHANNEL, REGION)).toBeNull();
	});
});

describe('ChannelRegionService — at most one fallback region per channel', () => {
	it('moves the flag from the current holder in one transaction', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [
				membershipRow(CHANNEL, REGION, { isDefault: true }),
				membershipRow(CHANNEL, OTHER_REGION)
			]
		});

		await store.service.setDefaultRegion(CHANNEL, OTHER_REGION);

		expect(store.row(CHANNEL, OTHER_REGION)?.isDefault).toBe(true);
		expect(store.row(CHANNEL, REGION)?.isDefault).toBe(false);
		expect(store.locks).toContain('channel_region:pessimistic_write');
	});

	it('refuses a region that is not published to the channel', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		expect(await refusalOf(() => store.service.setDefaultRegion(CHANNEL, OTHER_REGION))).toMatch(
			/^VALIDATION_FAILED: REGION_NOT_SUPPORTED_FOR_CHANNEL/
		);
	});
});

describe('ChannelRegionService — withdrawing a region, and the channel default (I-27)', () => {
	it('withdraws a region the channel does not name as its default', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		await store.service.unpublishRegion(CHANNEL, REGION);

		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeInstanceOf(Date);
	});

	it('refuses to withdraw the region the channel names as its default', async () => {
		const store = world({
			channels: [channelRow(CHANNEL, { defaultRegionId: REGION })],
			regions: [regionRow(REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		expect(await refusalOf(() => store.service.unpublishRegion(CHANNEL, REGION))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_DEFAULT_REGION_PUBLISHED/
		);
		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeUndefined();

		// Clearing the channel's default region is what releases the membership.
		store.channel()!.defaultRegionId = null;

		await store.service.unpublishRegion(CHANNEL, REGION);

		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeInstanceOf(Date);
	});

	it('refuses a pair that is not published at all', async () => {
		const store = world({ channels: [channelRow(CHANNEL)], regions: [regionRow(REGION)] });

		expect(await refusalOf(() => store.service.unpublishRegion(CHANNEL, REGION))).toMatch(
			/^RESOURCE_NOT_FOUND: REGION_NOT_SUPPORTED_FOR_CHANNEL/
		);
	});
});

describe('ChannelRegionService — the whole-set replacement', () => {
	it('publishes what is stated, withdraws what is left out, and moves the fallback flag', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [membershipRow(CHANNEL, REGION, { isDefault: true }), membershipRow(CHANNEL, OTHER_REGION)]
		});

		await store.service.replaceRegions(CHANNEL, [
			{ regionId: REGION, isDefault: true },
			{ regionId: 'region-3' }
		]);

		expect(store.row(CHANNEL, REGION)?.isDefault).toBe(true);
		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeUndefined();
		expect(store.row(CHANNEL, OTHER_REGION)?.deletedAt).toBeInstanceOf(Date);
		expect(store.row(CHANNEL, 'region-3')).toBeDefined();
	});

	it('refuses a set that names one region twice, or two fallbacks', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)]
		});

		expect(
			await refusalOf(() => store.service.replaceRegions(CHANNEL, [{ regionId: REGION }, { regionId: REGION }]))
		).toMatch(/^UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_REGION_EXISTS/);

		expect(
			await refusalOf(() =>
				store.service.replaceRegions(CHANNEL, [
					{ regionId: REGION, isDefault: true },
					{ regionId: OTHER_REGION, isDefault: true }
				])
			)
		).toMatch(/^UNIQUE_CONSTRAINT_VIOLATION/);
	});

	it('refuses to withdraw the channel default as part of a set, and refuses a member with no region', async () => {
		const store = world({
			channels: [channelRow(CHANNEL, { defaultRegionId: REGION })],
			regions: [regionRow(REGION), regionRow(OTHER_REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		expect(await refusalOf(() => store.service.replaceRegions(CHANNEL, [{ regionId: OTHER_REGION }]))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_DEFAULT_REGION_PUBLISHED/
		);
		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeUndefined();

		expect(await refusalOf(() => store.service.replaceRegions(CHANNEL, [{} as never]))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
	});

	it('empties the set when nothing is stated, which is a legitimate state', async () => {
		const store = world({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)],
			memberships: [membershipRow(CHANNEL, REGION)]
		});

		await store.service.replaceRegions(CHANNEL, []);

		expect(store.row(CHANNEL, REGION)?.deletedAt).toBeInstanceOf(Date);
	});
});
