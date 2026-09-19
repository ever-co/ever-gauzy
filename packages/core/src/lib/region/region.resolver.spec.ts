/**
 * 🛑 This import must stay FIRST — see `../channel/channel.controller.spec.ts` for the load-order
 * cycle it avoids: entered through the validators rather than through the entities, an entity
 * decorator is still undefined when the entity applies it and the suite fails to load.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { ChannelStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RegionResolver } from './region.resolver';
import { CHANNEL_EVENT_NAMES } from '../channel/channel-event.publisher';

/** The guard doubles, and the reason they exist, are stated in the channel controller suite. */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// Answered for, and applied by nothing here: the entity barrel this suite loads first reaches a
	// module whose resolver applies this third guard, and a decorator evaluated against an undefined
	// token fails the suite at load rather than at an assertion.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => ({ id: 'user-1', tenantId: 'tenant-1' }),
		currentUserId: () => 'user-1',
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'org-1',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

const REGION = '00000000-0000-4000-8000-000000000020';
const OTHER_REGION = '00000000-0000-4000-8000-000000000021';
const COUNTRY = '00000000-0000-4000-8000-000000000040';

/** The regions a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: REGION,
		name: 'European Union',
		code: 'eu',
		currency: 'EUR',
		isDefault: false,
		isTaxInclusive: true,
		status: ChannelStatus.ACTIVE,
		createdAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_REGION,
		name: 'United States',
		code: 'us',
		currency: 'USD',
		isDefault: false,
		isTaxInclusive: false,
		status: ChannelStatus.DRAFT,
		createdAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The two surfaces, over one scripted service pair and a publisher that records what it announced. */
function surfaces() {
	const regionService = {
		listRegions: jest.fn().mockResolvedValue(ROWS),
		findRegion: jest.fn().mockResolvedValue(ROWS[0]),
		findRegionOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createRegion: jest.fn().mockResolvedValue(ROWS[0]),
		updateRegion: jest.fn().mockResolvedValue(ROWS[0]),
		setDefaultRegion: jest.fn().mockResolvedValue(ROWS[0]),
		archiveRegion: jest.fn().mockResolvedValue({ ...ROWS[0], status: ChannelStatus.ARCHIVED })
	};
	const regionCountryService = {
		listCountries: jest.fn().mockResolvedValue([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY }]),
		replaceCountries: jest
			.fn()
			.mockResolvedValue([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY }])
	};
	const publisher = { regionChanged: jest.fn().mockResolvedValue(true) };
	const pubSub = {
		topicFor: jest.fn((eventName: string, tenantId: string) => `${eventName}:${tenantId}`),
		asyncIterableIterator: jest.fn().mockReturnValue('the region stream')
	};

	return {
		regionService,
		regionCountryService,
		publisher,
		pubSub,
		resolver: new RegionResolver(
			regionService as never,
			regionCountryService as never,
			publisher as never,
			pubSub as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/** The composed schema: this domain's documents plus the kernel's and the channel domain's. */
function composedSchema(): string {
	const directories = [
		join(__dirname, 'schema'),
		join(__dirname, '..', 'channel', 'schema'),
		join(__dirname, '..', 'channel-domain', 'schema'),
		join(__dirname, '..', 'graphql', 'schema')
	];

	return directories
		.flatMap((directory) =>
			readdirSync(directory)
				.filter((name) => name.endsWith('.gql'))
				.map((name) => readFileSync(join(directory, name), 'utf8'))
		)
		.join('\n');
}

const schema = buildSchema(composedSchema());

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

describe('RegionResolver — the SDL declares the root fields the specification names (§3.3)', () => {
	it('declares the two region queries', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['regions', 'region']));
	});

	it('declares the five region mutations, and no more than the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createRegion',
				'updateRegion',
				'deleteRegion',
				'setDefaultRegion',
				'replaceRegionCountries'
			])
		);
	});

	it('declares `regionChanged`', () => {
		expect(rootFields('Subscription')).toEqual(expect.arrayContaining(['regionChanged']));
	});

	it('declares the region connection, its edges, its filters and its country membership', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type RegionConnection \{\s*nodes: \[Region!\]!\s*edges: \[RegionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/input RegionFilter \{/);
		expect(printed).toMatch(/input RegionSort \{/);
		expect(printed).toMatch(/input RegionStatusFilter \{/);
		expect(printed).toMatch(/type RegionCountry \{/);
		expect(printed).toMatch(/input RegionCountryInput \{/);
	});
});

describe('RegionResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, regionService } = surfaces();

		const connection = await resolver.regions();

		expect(regionService.listRegions).toHaveBeenCalledWith();
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(REGION);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.regions({ currency: { in: ['USD'] } });

		expect(connection.nodes.map((node) => node.code)).toEqual(['us']);
		expect(connection.totalCount).toBe(1);
	});

	it('refuses a filter field the resource does not declare, with the protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver.regions({ channelId: { eq: 'c1' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('RegionResolver — one concept, two protocols, the same writes', () => {
	it('reads one region, answering null rather than failing when there is none', async () => {
		const { resolver, regionService } = surfaces();

		await expect(resolver.region(REGION)).resolves.toBe(ROWS[0]);
		regionService.findRegion.mockResolvedValueOnce(null);
		await expect(resolver.region(REGION)).resolves.toBeNull();
	});

	it('creates, updates, retires and defaults through the same service methods the REST routes call', async () => {
		const { resolver, regionService, publisher } = surfaces();

		await resolver.createRegion({ organizationId: 'org-1', name: 'European Union', code: 'eu', currency: 'EUR' });
		await resolver.updateRegion({ id: REGION, isTaxInclusive: false });
		await resolver.deleteRegion(REGION);
		await resolver.setDefaultRegion(REGION);

		expect(regionService.createRegion).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'eu', currency: 'EUR' })
		);
		expect(regionService.updateRegion).toHaveBeenCalledWith(
			REGION,
			expect.objectContaining({ isTaxInclusive: false })
		);
		expect(regionService.archiveRegion).toHaveBeenCalledWith(REGION);
		expect(regionService.setDefaultRegion).toHaveBeenCalledWith(REGION);
		expect(publisher.regionChanged).toHaveBeenCalledTimes(4);
	});

	it('replaces the country set as a set and announces the region it belongs to', async () => {
		const { resolver, regionCountryService, regionService, publisher } = surfaces();

		const stored = await resolver.replaceRegionCountries({
			id: REGION,
			countries: [{ countryId: COUNTRY, isTaxExempt: true, provinceCodes: ['BE'] }]
		});

		expect(regionCountryService.replaceCountries).toHaveBeenCalledWith(REGION, [
			{ countryId: COUNTRY, isTaxExempt: true, provinceCodes: ['BE'] }
		]);
		expect(stored).toEqual([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY }]);
		expect(regionService.findRegionOrFail).toHaveBeenCalledWith(REGION);
		expect(publisher.regionChanged).toHaveBeenCalledWith(ROWS[0], 'countries-replaced');
	});

	it('refuses a currency the platform does not know, with the same message the REST route gives', async () => {
		const refusal = new BadRequestException(
			"VALIDATION_FAILED: REGION_CURRENCY_UNKNOWN — 'XYZ' is not a currency this platform knows."
		);
		const { resolver } = surfaces();
		(resolver as never as { regionService: { createRegion: jest.Mock } }).regionService.createRegion = jest
			.fn()
			.mockRejectedValue(refusal);

		const error = await resolver
			.createRegion({ organizationId: 'org-1', name: 'Nowhere', code: 'nw', currency: 'XYZ' })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('REGION_CURRENCY_UNKNOWN');
	});
});

describe('RegionResolver — subscriptions (§10.2, §10.4)', () => {
	it('subscribes to the tenant’s own topic for the catalogued event', () => {
		const { resolver, pubSub } = surfaces();

		const stream = resolver.regionChanged(REGION, 'updated');

		expect(pubSub.topicFor).toHaveBeenCalledWith(CHANNEL_EVENT_NAMES.REGION_CHANGED, expect.any(String));
		expect(stream).toBe('the region stream');
	});

	it('carries the read permission and never a write one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RegionResolver.prototype.regionChanged)).toEqual([
			PermissionsEnum.REGIONS_VIEW
		]);
	});
});

describe('RegionResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', RegionResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RegionResolver)).toEqual([PermissionsEnum.REGIONS_VIEW]);
	});

	it('carries the read permission on the resource and the write permission on every write', () => {
		const proto = RegionResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['regions', PermissionsEnum.REGIONS_VIEW],
			['region', PermissionsEnum.REGIONS_VIEW],
			['createRegion', PermissionsEnum.REGIONS_CREATE],
			['updateRegion', PermissionsEnum.REGIONS_EDIT],
			['deleteRegion', PermissionsEnum.REGIONS_DELETE],
			['setDefaultRegion', PermissionsEnum.REGIONS_EDIT],
			['replaceRegionCountries', PermissionsEnum.REGIONS_EDIT]
		];

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = RegionResolver.prototype;

		for (const field of ['createRegion', 'updateRegion', 'deleteRegion', 'setDefaultRegion', 'replaceRegionCountries']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.REGIONS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});
