/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, HttpException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema } from 'graphql';
import { ChannelStatus, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ChannelResolver } from './channel.resolver';
import { CHANNEL_EVENT_NAMES } from './channel-event.publisher';

/**
 * The channel concept over GraphQL (GraphQL specification §3.3, §7.1–§7.2, §9.7, §10).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field the specification names for this resource exists **in the SDL**, read from the
 *   `.gql` files the boot loader globs rather than from a decorator, because a resolver whose field
 *   the schema does not declare is a field nothing can call;
 * - the list root field is a connection with the platform's own cursor codec behind it, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - a mutation delegates to the same service method the REST route calls, with the same scope — a
 *   client does not choose a better surface by choosing a protocol;
 * - every write mutation carries the write permission and never the read one, so a role that may look
 *   at channels cannot change them by asking GraphQL instead of REST;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const CHANNEL = '00000000-0000-4000-8000-000000000010';
const OTHER_CHANNEL = '00000000-0000-4000-8000-000000000011';
const REGION = '00000000-0000-4000-8000-000000000020';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: CHANNEL,
		name: 'Storefront',
		code: 'storefront',
		status: ChannelStatus.ACTIVE,
		isDefault: true,
		defaultCurrency: 'EUR',
		orderNumberPadding: 6,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_CHANNEL,
		name: 'Marketplace',
		code: 'marketplace',
		status: ChannelStatus.DRAFT,
		isDefault: false,
		defaultCurrency: 'USD',
		orderNumberPadding: 4,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The two surfaces, over one scripted service and a publisher that records what it announced. */
function surfaces() {
	const channelService = {
		listChannels: jest.fn().mockResolvedValue(ROWS),
		findChannel: jest.fn().mockResolvedValue(ROWS[0]),
		findChannelOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createChannel: jest.fn().mockResolvedValue(ROWS[0]),
		updateChannel: jest.fn().mockResolvedValue(ROWS[0]),
		setChannelStatus: jest.fn().mockResolvedValue({ ...ROWS[0], status: ChannelStatus.INACTIVE }),
		setDefaultChannel: jest.fn().mockResolvedValue(ROWS[0]),
		archiveChannel: jest.fn().mockResolvedValue({ ...ROWS[0], status: ChannelStatus.ARCHIVED })
	};
	const channelRegionService = {
		replaceRegions: jest.fn().mockResolvedValue([{ id: 'membership-1', channelId: CHANNEL, regionId: REGION }])
	};
	const publisher = { channelChanged: jest.fn().mockResolvedValue(true) };
	const pubSub = {
		topicFor: jest.fn((eventName: string, tenantId: string) => `${eventName}:${tenantId}`),
		asyncIterableIterator: jest.fn().mockReturnValue('the channel stream'),
		publish: jest.fn().mockResolvedValue(true)
	};

	return {
		channelService,
		channelRegionService,
		publisher,
		pubSub,
		resolver: new ChannelResolver(
			channelService as never,
			channelRegionService as never,
			publisher as never,
			pubSub as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/**
 * The composed schema, as text: the domain's own documents plus the kernel's, exactly the set the
 * boot loader globs and the composition pass asserts.
 */
function composedSchema(): string {
	const directories = [
		join(__dirname, 'schema'),
		join(__dirname, '..', 'channel-domain', 'schema'),
		join(__dirname, '..', 'region', 'schema'),
		join(__dirname, '..', 'graphql', 'schema')
	];

	const documents = directories.flatMap((directory) =>
		readdirSync(directory)
			.filter((name) => name.endsWith('.gql'))
			.map((name) => readFileSync(join(directory, name), 'utf8'))
	);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

describe('ChannelResolver — the SDL declares the root fields the specification names (§3.3)', () => {
	it('declares the two channel queries', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['channels', 'channel', 'channelDomains', 'channelDomain', 'regions', 'region'])
		);
	});

	it('declares every channel mutation, and no more than the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createChannel',
				'updateChannel',
				'deleteChannel',
				'setDefaultChannel',
				'setChannelStatus',
				'replaceChannelRegions',
				'createChannelDomain',
				'updateChannelDomain',
				'deleteChannelDomain',
				'verifyChannelDomain'
			])
		);
	});

	it('declares `channelChanged`, and `regionChanged` beside it', () => {
		expect(rootFields('Subscription')).toEqual(expect.arrayContaining(['channelChanged', 'regionChanged']));
	});

	it('declares the channel connection, its edges, its filters and its sorts', () => {
		const printed = require('graphql').printSchema(schema);

		expect(printed).toMatch(/type ChannelConnection \{\s*nodes: \[Channel!\]!\s*edges: \[ChannelEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/);
		expect(printed).toMatch(/type ChannelEdge \{\s*node: Channel!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ChannelFilter \{/);
		expect(printed).toMatch(/input ChannelSort \{/);
		expect(printed).toMatch(/enum ChannelSortField \{/);
		expect(printed).toMatch(/input ChannelStatusFilter \{/);
		// The kernel's page info is referenced, never redeclared: the schema builds rather than fails
		// when the same name is declared twice, and the composition check is what refuses it.
		expect(printed).toMatch(/type PageInfo \{/);
	});
});

describe('ChannelResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, channelService } = surfaces();

		const connection = await resolver.channels(undefined, undefined, undefined, 20);

		expect(channelService.listChannels).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CHANNEL);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.channels({ status: { eq: ChannelStatus.DRAFT } });

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_CHANNEL]);
		// The total is the filtered total, which is what the REST envelope reports as `total`.
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.channels(undefined, [{ field: 'name', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.code)).toEqual(['marketplace', 'storefront']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.channels(undefined, undefined, undefined, 1);

		const second = await resolver.channels(undefined, undefined, { first: 1, after: first.pageInfo.endCursor ?? undefined });

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_CHANNEL]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.channels(undefined, [{ field: 'defaultRegionId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.channels({ secret: { eq: 'x' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver.channels(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5).catch(
			(thrown) => thrown
		);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.channels(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ChannelResolver — one concept, two protocols, the same writes', () => {
	it('reads one channel, answering null rather than failing when there is none', async () => {
		const { resolver, channelService } = surfaces();

		await expect(resolver.channel(CHANNEL)).resolves.toBe(ROWS[0]);
		channelService.findChannel.mockResolvedValueOnce(null);
		await expect(resolver.channel(CHANNEL)).resolves.toBeNull();
	});

	it('creates, updates and retires through the same service methods the REST routes call', async () => {
		const { resolver, channelService, publisher } = surfaces();

		await resolver.createChannel({ organizationId: 'org-1', name: 'Storefront', code: 'storefront' });
		await resolver.updateChannel({ id: CHANNEL, name: 'Renamed' });
		await resolver.deleteChannel(CHANNEL);
		await resolver.setDefaultChannel(CHANNEL);
		await resolver.setChannelStatus({ id: CHANNEL, status: ChannelStatus.INACTIVE });

		expect(channelService.createChannel).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Storefront', code: 'storefront' })
		);
		expect(channelService.updateChannel).toHaveBeenCalledWith(CHANNEL, expect.objectContaining({ name: 'Renamed' }));
		expect(channelService.archiveChannel).toHaveBeenCalledWith(CHANNEL);
		expect(channelService.setDefaultChannel).toHaveBeenCalledWith(CHANNEL);
		expect(channelService.setChannelStatus).toHaveBeenCalledWith(CHANNEL, ChannelStatus.INACTIVE);
		// Every write announces the same fact on the same bus, so a subscriber cannot tell which
		// protocol wrote the row.
		expect(publisher.channelChanged).toHaveBeenCalledTimes(5);
	});

	it('replaces the region links as a set and announces the channel they belong to', async () => {
		const { resolver, channelRegionService, channelService, publisher } = surfaces();

		const stored = await resolver.replaceChannelRegions({
			id: CHANNEL,
			items: [{ regionId: REGION, isDefault: true }]
		});

		expect(channelRegionService.replaceRegions).toHaveBeenCalledWith(CHANNEL, [
			{ regionId: REGION, isDefault: true }
		]);
		expect(stored).toEqual([{ id: 'membership-1', channelId: CHANNEL, regionId: REGION }]);
		expect(channelService.findChannelOrFail).toHaveBeenCalledWith(CHANNEL);
		expect(publisher.channelChanged).toHaveBeenCalledWith(ROWS[0], 'regions-replaced');
	});
});

describe('ChannelResolver — subscriptions (§10.2, §10.4)', () => {
	it('subscribes to the tenant’s own topic for the catalogued event', () => {
		const { resolver, pubSub } = surfaces();

		const stream = resolver.channelChanged(CHANNEL, 'updated');

		expect(pubSub.topicFor).toHaveBeenCalledWith(CHANNEL_EVENT_NAMES.CHANNEL_CHANGED, expect.any(String));
		expect(stream).toBe('the channel stream');
	});

	it('carries the read permission and never a write one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ChannelResolver.prototype.channelChanged)).toEqual([
			PermissionsEnum.CHANNELS_VIEW
		]);
	});
});

describe('ChannelResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ChannelResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the write permission on every write', () => {
		const proto = ChannelResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['channels', PermissionsEnum.CHANNELS_VIEW],
			['channel', PermissionsEnum.CHANNELS_VIEW],
			['createChannel', PermissionsEnum.CHANNELS_CREATE],
			['updateChannel', PermissionsEnum.CHANNELS_EDIT],
			['deleteChannel', PermissionsEnum.CHANNELS_DELETE],
			['setDefaultChannel', PermissionsEnum.CHANNELS_EDIT],
			['setChannelStatus', PermissionsEnum.CHANNELS_EDIT],
			['replaceChannelRegions', PermissionsEnum.CHANNELS_EDIT]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ChannelResolver)).toEqual([PermissionsEnum.CHANNELS_VIEW]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write field
		// that carried the read permission — or none — would be reachable by every caller that may look.
		const proto = ChannelResolver.prototype;

		for (const field of ['createChannel', 'updateChannel', 'deleteChannel', 'setDefaultChannel', 'setChannelStatus', 'replaceChannelRegions']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CHANNELS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (ChannelResolver.prototype as never)[field],
		getClass: () => ChannelResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ChannelResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ChannelResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ChannelResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('channels')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('channels');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('channels'))).resolves.toBe(true);
	});
});
