/**
 * The sales context — the channel a request is for (schema chapter §3.1, §3.2, §3.5).
 *
 * Five rules, and the suite walks each of them: at most one default channel per organization and the
 * default is never removed, `code` is written once, a channel serves only when it is `ACTIVE` and at
 * least one hostname resolves to it (invariant I-25), the channel's default region is one of its own
 * (invariant I-27), and retirement is archiving rather than deletion.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph — a unit test pays for the narrowest surface the module under test touches. The services under
 * test are the real ones, over an in-memory set of tables that applies the `where` the service states,
 * so a service that stopped scoping its reads is caught here rather than accommodated.
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
	// The suite runs as Postgres so the row lock the default and primary paths take is the statement a
	// production deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ChannelStatus } from '@gauzy/contracts';
import { Channel } from './channel.entity';
import { ChannelService } from './channel.service';
import { ChannelDomain } from '../channel-domain/channel-domain.entity';
import { ChannelDomainService } from '../channel-domain/channel-domain.service';
import { ChannelRegion } from '../channel-region/channel-region.entity';
import { ChannelRegionService } from '../channel-region/channel-region.service';
import { Region } from '../region/region.entity';
import { RegionService } from '../region/region.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL = 'channel-1';
const OTHER_CHANNEL = 'channel-2';
const REGION = 'region-1';
const OTHER_REGION = 'region-2';

type Row = Record<string, any>;

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[Channel, 'channel'],
	[ChannelDomain, 'channel_domain'],
	[ChannelRegion, 'channel_region'],
	[Region, 'region']
]);

/**
 * An in-memory stand-in for the five tables and the transaction manager they are written through.
 *
 * The `where` the service states is applied — equality, with a missing column and a null column treated
 * as the same thing to the database — so a read that stopped narrowing is caught here.
 */
function world(
	seed: {
		channels?: Row[];
		domains?: Row[];
		memberships?: Row[];
		regions?: Row[];
		organizations?: Row[];
	} = {}
) {
	const tables: Record<string, Row[]> = {
		channel: [...(seed.channels ?? [])],
		channel_domain: [...(seed.domains ?? [])],
		channel_region: [...(seed.memberships ?? [])],
		region: [...(seed.regions ?? [])],
		organization: [...(seed.organizations ?? [])]
	};
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
		findOne: async (entity: unknown, options: any = {}) => {
			statements.push({ readOne: tableOf(entity), ...options.where });

			return tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null;
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

	return {
		tables,
		locks,
		statements,
		repository,
		channel: (id: string = CHANNEL) => tables.channel.find((row) => row.id === id),
		membership: (channelId: string, regionId: string) =>
			tables.channel_region.find((row) => row.channelId === channelId && row.regionId === regionId)
	};
}

/** One `channel` row, with the fields this suite reads. */
const channelRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Channel ${id}`,
	code: id.toUpperCase(),
	status: ChannelStatus.DRAFT,
	isDefault: false,
	defaultCurrency: 'USD',
	orderNumberPadding: 6,
	...overrides
});

/** One `channel_domain` row. */
const domainRow = (channelId: string, hostname: string, overrides: Row = {}): Row => ({
	id: `domain-${hostname}`,
	tenantId: TENANT,
	organizationId: ORG,
	channelId,
	hostname,
	isPrimary: true,
	isSslEnabled: true,
	redirectToPrimary: false,
	...overrides
});

/** One `organization` row, narrowed to the one fact a channel inherits from it. */
const organizationRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	name: `Organization ${id}`,
	currency: 'USD',
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

/** The services under test, over one in-memory world. */
function channels(
	seed: {
		channels?: Row[];
		domains?: Row[];
		memberships?: Row[];
		regions?: Row[];
		organizations?: Row[];
	} = {}
) {
	const store = world(seed);
	const currencyService = {
		find: async (options: any = {}) =>
			['USD', 'EUR'].includes(options?.where?.isoCode) ? [{ isoCode: options.where.isoCode }] : []
	};
	const regionService = new RegionService(
		store.repository('region') as never,
		{} as never,
		currencyService as never
	);
	const channelRegionService = new ChannelRegionService(
		store.repository('channel_region') as never,
		{} as never,
		regionService,
		store.repository('channel') as never
	);
	const channelDomainService = new ChannelDomainService(
		store.repository('channel_domain') as never,
		{} as never
	);
	const channelService = new ChannelService(
		store.repository('channel') as never,
		{} as never,
		channelDomainService,
		channelRegionService,
		// The organization is read for the currency a channel inherits from it.
		store.repository('organization') as never
	);

	return { ...store, channelService, channelDomainService, channelRegionService };
}

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('ChannelService — opening a sales context', () => {
	it('creates the channel DRAFT, with its code trimmed and its currency stated', async () => {
		const { channelService, channel } = channels();

		const created = await channelService.createChannel({
			name: '  Main storefront  ',
			code: ' main ',
			defaultCurrency: 'eur',
			orderNumberPrefix: 'WEB'
		});

		expect(created.name).toBe('Main storefront');
		expect(created.code).toBe('main');
		expect(created.defaultCurrency).toBe('EUR');
		expect(created.status).toBe(ChannelStatus.DRAFT);
		expect(created.isDefault).toBe(false);
		expect(created.orderNumberPadding).toBe(6);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(channel(created.id)).toBeDefined();
	});

	it('refuses a creation with no name or no code, because neither can be invented', async () => {
		const { channelService } = channels();

		expect(await refusalOf(() => channelService.createChannel({ name: '  ', code: 'web' }))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(await refusalOf(() => channelService.createChannel({ name: 'Web', code: ' ' }))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
	});

	it('refuses a currency that is not a three-letter code', async () => {
		const { channelService } = channels();

		expect(
			await refusalOf(() => channelService.createChannel({ name: 'Web', code: 'web', defaultCurrency: 'EU' }))
		).toMatch(/^VALIDATION_FAILED/);
	});

	it('inherits the organization currency when the caller states none', async () => {
		const { channelService } = channels({ organizations: [organizationRow(ORG, { currency: 'EUR' })] });

		const created = await channelService.createChannel({ name: 'Web', code: 'web' });

		// The channel does not choose its currency: a channel that defaulted to a constant would price
		// the same catalogue differently from the organization's own ledgers.
		expect(created.defaultCurrency).toBe('EUR');
	});

	it('falls back to the schema default when the organization states no usable currency', async () => {
		const { channelService } = channels();

		// No organization row at all: a currency that cannot be read is a gap in the organization's own
		// configuration, not a reason to leave a channel unwritable.
		expect((await channelService.createChannel({ name: 'Web', code: 'web' })).defaultCurrency).toBe('USD');

		const { channelService: misconfigured } = channels({
			organizations: [organizationRow(ORG, { currency: '' })]
		});

		expect((await misconfigured.createChannel({ name: 'Web', code: 'web' })).defaultCurrency).toBe('USD');
	});

	it('refuses a code the organization already uses among its live rows', async () => {
		const { channelService } = channels({ channels: [channelRow(CHANNEL, { code: 'WEB' })] });

		expect(await refusalOf(() => channelService.createChannel({ name: 'Web', code: 'WEB' }))).toMatch(
			/^UNIQUE_CONSTRAINT_VIOLATION/
		);
	});
});

describe('ChannelService — the lifecycle, and the hostname a serving channel needs (I-25)', () => {
	it('moves DRAFT to ACTIVE or ARCHIVED, and DRAFT to INACTIVE is not an edge', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL), channelRow(OTHER_CHANNEL)],
			domains: [domainRow(CHANNEL, 'shop.example.com')]
		});

		// A channel that was never switched on has not been switched off.
		expect(
			await refusalOf(() => channelService.setChannelStatus(CHANNEL, ChannelStatus.INACTIVE))
		).toMatch(/^PRECONDITION_REQUIRED: CHANNEL_STATUS_INVALID/);

		expect((await channelService.setChannelStatus(CHANNEL, ChannelStatus.ACTIVE)).status).toBe(
			ChannelStatus.ACTIVE
		);
		expect((await channelService.setChannelStatus(CHANNEL, ChannelStatus.INACTIVE)).status).toBe(
			ChannelStatus.INACTIVE
		);
		expect((await channelService.setChannelStatus(CHANNEL, ChannelStatus.ACTIVE)).status).toBe(
			ChannelStatus.ACTIVE
		);
		expect((await channelService.setChannelStatus(OTHER_CHANNEL, ChannelStatus.ARCHIVED)).status).toBe(
			ChannelStatus.ARCHIVED
		);
	});

	it('treats ARCHIVED as terminal', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL, { status: ChannelStatus.ARCHIVED })]
		});

		for (const next of [ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.DRAFT]) {
			expect(await refusalOf(() => channelService.setChannelStatus(CHANNEL, next))).toMatch(
				/^PRECONDITION_REQUIRED: CHANNEL_STATUS_INVALID/
			);
		}
	});

	it('refuses a status no channel can hold', async () => {
		const { channelService } = channels({ channels: [channelRow(CHANNEL)] });

		expect(await refusalOf(() => channelService.setChannelStatus(CHANNEL, 'LIVE' as never))).toMatch(
			/^VALIDATION_INVALID_ENUM/
		);
	});

	it('refuses ACTIVE while no hostname resolves to the channel (invariant I-25)', async () => {
		const { channelService, channel } = channels({ channels: [channelRow(CHANNEL)] });

		expect(await refusalOf(() => channelService.setChannelStatus(CHANNEL, ChannelStatus.ACTIVE))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_SETUP_INCOMPLETE/
		);
		expect(channel()?.status).toBe(ChannelStatus.DRAFT);
	});

	it('activates once a hostname is bound, and refuses every status but ACTIVE at the serving guard', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL)],
			domains: [domainRow(CHANNEL, 'shop.example.com')]
		});

		const active = await channelService.setChannelStatus(CHANNEL, ChannelStatus.ACTIVE);

		expect(() => channelService.assertServing(active)).not.toThrow();

		for (const status of [ChannelStatus.DRAFT, ChannelStatus.INACTIVE, ChannelStatus.ARCHIVED]) {
			expect(() => channelService.assertServing({ code: 'WEB', status } as never)).toThrow(
				/^CHANNEL_NOT_RESOLVED: CHANNEL_INACTIVE/
			);
		}
	});
});

describe('ChannelService — the default channel (CHANNEL_DEFAULT_IMMUTABLE)', () => {
	it('claims the flag and releases it from the previous holder in one transaction', async () => {
		const { channelService, channel, statements } = channels({
			channels: [channelRow(CHANNEL, { isDefault: true }), channelRow(OTHER_CHANNEL)]
		});

		await channelService.setDefaultChannel(OTHER_CHANNEL);

		expect(channel(OTHER_CHANNEL)?.isDefault).toBe(true);
		expect(channel(CHANNEL)?.isDefault).toBe(false);
		// The move ran through the channel's own transaction, not a second one opened beside it.
		expect(statements.some((one) => one.lockedRead === 'channel')).toBe(true);
	});

	it('refuses to make an archived channel the default', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL, { status: ChannelStatus.ARCHIVED })]
		});

		expect(await refusalOf(() => channelService.setDefaultChannel(CHANNEL))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_STATUS_INVALID/
		);
	});

	it('finds the organization default and answers null when there is none', async () => {
		const { channelService } = channels({ channels: [channelRow(CHANNEL)] });

		expect(await channelService.findDefaultChannel()).toBeNull();

		const { channelService: withDefault } = channels({
			channels: [channelRow(CHANNEL, { isDefault: true }), channelRow(OTHER_CHANNEL)]
		});

		expect((await withDefault.findDefaultChannel())?.id).toBe(CHANNEL);
	});

	it('refuses to archive or remove the organization default', async () => {
		const { channelService, channel } = channels({
			channels: [channelRow(CHANNEL, { isDefault: true })]
		});

		expect(await refusalOf(() => channelService.archiveChannel(CHANNEL))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_DEFAULT_IMMUTABLE/
		);
		expect(await refusalOf(() => channelService.softRemoveChannel(CHANNEL))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_DEFAULT_IMMUTABLE/
		);
		expect(channel()?.status).toBe(ChannelStatus.DRAFT);
		expect(channel()?.deletedAt).toBeUndefined();
	});
});

describe('ChannelService — retirement is archiving, and the code is written once', () => {
	it('archives a channel instead of deleting it, and is idempotent', async () => {
		const { channelService, channel } = channels({
			channels: [channelRow(CHANNEL, { status: ChannelStatus.ACTIVE })],
			domains: [domainRow(CHANNEL, 'shop.example.com')]
		});

		const archived = await channelService.archiveChannel(CHANNEL);

		expect(archived.status).toBe(ChannelStatus.ARCHIVED);
		expect(archived.isArchived).toBe(true);
		expect(channel()?.archivedAt).toBeInstanceOf(Date);

		const again = await channelService.archiveChannel(CHANNEL);

		expect(again.status).toBe(ChannelStatus.ARCHIVED);
	});

	it('soft-deletes a channel that is not the default, keeping the row', async () => {
		const { channelService, channel } = channels({ channels: [channelRow(CHANNEL)] });

		await channelService.softRemoveChannel(CHANNEL);

		expect(channel()?.deletedAt).toBeInstanceOf(Date);
	});

	it('refuses a descriptive update that carries the code', async () => {
		const { channelService, channel } = channels({ channels: [channelRow(CHANNEL, { code: 'WEB' })] });

		expect(await refusalOf(() => channelService.updateChannel(CHANNEL, { code: 'STORE' } as never))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_CODE_IMMUTABLE/
		);
		expect(channel()?.code).toBe('WEB');
	});

	it('applies the descriptive facts it does own', async () => {
		const { channelService, channel } = channels({ channels: [channelRow(CHANNEL)] });

		await channelService.updateChannel(CHANNEL, {
			name: ' Renamed ',
			defaultLocale: 'de-DE',
			orderNumberPrefix: 'DE',
			metadata: { note: 'kept' }
		});

		expect(channel()?.name).toBe('Renamed');
		expect(channel()?.defaultLocale).toBe('de-DE');
		expect(channel()?.orderNumberPrefix).toBe('DE');
		expect(channel()?.metadata).toEqual({ note: 'kept' });
	});
});

describe('ChannelService — the default region is one of the channel regions (I-27)', () => {
	it('refuses a default region that is not published to the channel', async () => {
		const { channelService, channel } = channels({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)]
		});

		expect(await refusalOf(() => channelService.setDefaultRegion(CHANNEL, REGION))).toMatch(
			/^VALIDATION_FAILED: REGION_NOT_SUPPORTED_FOR_CHANNEL/
		);
		expect(channel()?.defaultRegionId).toBeUndefined();
	});

	it('names a published region, and clears it without withdrawing the membership', async () => {
		const { channelService, channel, membership } = channels({
			channels: [channelRow(CHANNEL)],
			regions: [regionRow(REGION)],
			memberships: [
				{ id: 'membership-1', tenantId: TENANT, organizationId: ORG, channelId: CHANNEL, regionId: REGION, isDefault: false }
			]
		});

		await channelService.setDefaultRegion(CHANNEL, REGION);

		expect(channel()?.defaultRegionId).toBe(REGION);

		await channelService.clearDefaultRegion(CHANNEL);

		expect(channel()?.defaultRegionId).toBeNull();
		// The region is still published: the channel simply no longer names it as the fallback.
		expect(membership(CHANNEL, REGION)?.deletedAt).toBeUndefined();
	});

	it('lists the hostnames and the regions the channel carries', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL)],
			domains: [domainRow(CHANNEL, 'shop.example.com')],
			regions: [regionRow(REGION)],
			memberships: [
				{ id: 'membership-1', tenantId: TENANT, organizationId: ORG, channelId: CHANNEL, regionId: REGION, isDefault: true }
			]
		});

		expect((await channelService.listChannelDomains(CHANNEL)).map((one) => one.hostname)).toEqual([
			'shop.example.com'
		]);
		expect((await channelService.listChannelRegions(CHANNEL)).map((one) => one.regionId)).toEqual([REGION]);
	});
});

describe('ChannelService — scoping and the answering form', () => {
	it('scopes every read to the caller, so a channel of another organization is not found', async () => {
		const { channelService } = channels({ channels: [channelRow(CHANNEL, { organizationId: 'another-org' })] });

		expect(await channelService.findChannel(CHANNEL)).toBeNull();
		expect(await refusalOf(() => channelService.findChannelOrFail(CHANNEL))).toMatch(
			/^RESOURCE_NOT_FOUND: CHANNEL_NOT_FOUND/
		);
	});

	it('answers null for a missing channel and refuses an identifier it must honour', async () => {
		const { channelService } = channels();

		expect(await channelService.findChannel('missing')).toBeNull();
		expect(await refusalOf(() => channelService.findChannelOrFail('missing'))).toMatch(
			/^RESOURCE_NOT_FOUND: CHANNEL_NOT_FOUND/
		);
	});

	it('finds a channel by its code, and lists default first', async () => {
		const { channelService } = channels({
			channels: [channelRow(CHANNEL, { code: 'WEB' }), channelRow(OTHER_CHANNEL, { code: 'POS', isDefault: true })]
		});

		expect((await channelService.findChannelByCode('POS'))?.id).toBe(OTHER_CHANNEL);

		const listed = await channelService.listChannels();

		expect(listed.map((one) => one.id)).toEqual([OTHER_CHANNEL, CHANNEL]);
	});
});
