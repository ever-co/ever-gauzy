/**
 * 🛑 This import must stay FIRST — see `channel.controller.spec.ts` for the load-order cycle it
 * avoids: entered through the validators rather than through the entities, an entity decorator is
 * still undefined when the entity applies it and the suite fails to load rather than to assert.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ChannelDomainResolver } from './channel-domain.resolver';

/** The guard doubles, and the reason they exist, are stated in `channel.controller.spec.ts`. */
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

const CHANNEL = '00000000-0000-4000-8000-000000000010';
const DOMAIN = '00000000-0000-4000-8000-000000000030';
const OTHER_DOMAIN = '00000000-0000-4000-8000-000000000031';

/** The hostname rows a scripted service answers with. */
const ROWS = [
	{
		id: DOMAIN,
		channelId: CHANNEL,
		hostname: 'shop.example',
		isPrimary: true,
		isSslEnabled: true,
		redirectToPrimary: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_DOMAIN,
		channelId: CHANNEL,
		hostname: 'www.example',
		isPrimary: false,
		isSslEnabled: true,
		redirectToPrimary: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver over one scripted service, so what it delegates to is asserted rather than inferred. */
function surfaces() {
	const channelDomainService = {
		find: jest.fn().mockResolvedValue(ROWS),
		findDomain: jest.fn().mockResolvedValue(ROWS[0]),
		findDomainOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		resolveChannelIdByHostname: jest.fn().mockResolvedValue(CHANNEL),
		bindDomain: jest.fn().mockResolvedValue(ROWS[0]),
		updateDomain: jest.fn().mockResolvedValue(ROWS[0]),
		unbindDomain: jest.fn().mockResolvedValue(ROWS[0])
	};
	const channelService = { findChannelOrFail: jest.fn().mockResolvedValue({ id: CHANNEL }) };
	const publisher = { channelChanged: jest.fn().mockResolvedValue(true) };

	return {
		channelDomainService,
		channelService,
		publisher,
		resolver: new ChannelDomainResolver(
			channelDomainService as never,
			channelService as never,
			publisher as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/** The composed schema: the domain's documents plus the channel's, the domain's sibling and the kernel's. */
function composedSchema(): string {
	const directories = [
		join(__dirname, 'schema'),
		join(__dirname, '..', 'channel', 'schema'),
		join(__dirname, '..', 'region', 'schema'),
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
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

describe('ChannelDomainResolver — the SDL declares the root fields the specification names (§3.3)', () => {
	it('declares the two hostname queries', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['channelDomains', 'channelDomain']));
	});

	it('declares the four hostname mutations', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createChannelDomain',
				'updateChannelDomain',
				'deleteChannelDomain',
				'verifyChannelDomain'
			])
		);
	});

	it('declares the hostname connection and the verification payload', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ChannelDomainConnection \{\s*nodes: \[ChannelDomain!\]!\s*edges: \[ChannelDomainEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type ChannelDomainVerification \{\s*verified: Boolean!\s*resolvedTo: ID\s*checkedAt: DateTime!\s*\}/
		);
		expect(printed).toMatch(/input ChannelDomainFilter \{/);
		expect(printed).toMatch(/enum ChannelDomainSortField \{/);
	});
});

describe('ChannelDomainResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, channelDomainService } = surfaces();

		const connection = await resolver.channelDomains();

		expect(channelDomainService.find).toHaveBeenCalledWith();
		expect(connection.totalCount).toBe(2);
		expect(connection.nodes.map((node) => node.hostname)).toEqual(['shop.example', 'www.example']);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
	});

	it('narrows by hostname, with the pattern operators the protocol declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.channelDomains({ hostname: { ilike: 'WWW%' } });

		expect(connection.nodes.map((node) => node.hostname)).toEqual(['www.example']);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.channelDomains(undefined, [{ field: 'hostname', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.hostname)).toEqual(['shop.example', 'www.example']);
	});

	it('refuses a sort field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.channelDomains(undefined, [{ field: 'channelId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});
});

describe('ChannelDomainResolver — one concept, two protocols, the same writes', () => {
	it('reads one hostname, answering null rather than failing when there is none', async () => {
		const { resolver, channelDomainService } = surfaces();

		await expect(resolver.channelDomain(DOMAIN)).resolves.toBe(ROWS[0]);
		channelDomainService.findDomain.mockResolvedValueOnce(null);
		await expect(resolver.channelDomain(DOMAIN)).resolves.toBeNull();
	});

	it('binds, updates and unbinds through the same service methods the REST routes call', async () => {
		const { resolver, channelDomainService, publisher, channelService } = surfaces();

		await resolver.createChannelDomain({ channelId: CHANNEL, hostname: 'shop.example' });
		await resolver.updateChannelDomain({ id: DOMAIN, isPrimary: true });
		await resolver.deleteChannelDomain(DOMAIN, true);

		expect(channelDomainService.bindDomain).toHaveBeenCalledWith({
			channelId: CHANNEL,
			hostname: 'shop.example'
		});
		expect(channelDomainService.updateDomain).toHaveBeenCalledWith(DOMAIN, { id: DOMAIN, isPrimary: true });
		expect(channelDomainService.unbindDomain).toHaveBeenCalledWith(DOMAIN, { force: true });
		// A hostname is part of the channel aggregate, so the fact announced is the channel's: a client
		// watching `channelChanged` is not asked to watch a pivot as well.
		expect(channelService.findChannelOrFail).toHaveBeenCalledWith(CHANNEL);
		expect(publisher.channelChanged).toHaveBeenCalledTimes(3);
	});

	it('verifies a hostname through the resolution the request guard itself makes', async () => {
		const { resolver, channelDomainService } = surfaces();

		const verification = await resolver.verifyChannelDomain(DOMAIN);

		expect(channelDomainService.resolveChannelIdByHostname).toHaveBeenCalledWith('shop.example');
		expect(verification).toMatchObject({ verified: true, resolvedTo: CHANNEL });
	});

	it('refuses to write a hostname that already resolves elsewhere', async () => {
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_DOMAIN_ALREADY_EXISTS — hostname 'shop.example' is already bound."
		);
		const { resolver } = surfaces();
		(resolver as never as { channelDomainService: { bindDomain: jest.Mock } }).channelDomainService.bindDomain =
			jest.fn().mockRejectedValue(refusal);

		const error = await resolver
			.createChannelDomain({ channelId: CHANNEL, hostname: 'shop.example' })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CHANNEL_DOMAIN_ALREADY_EXISTS');
	});
});

describe('ChannelDomainResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards, under the channel’s own permission', () => {
		const guards = Reflect.getMetadata('__guards__', ChannelDomainResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ChannelDomainResolver)).toEqual([
			PermissionsEnum.CHANNELS_VIEW
		]);
	});

	it('gives every root field the permission the endpoint table names', () => {
		const proto = ChannelDomainResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['channelDomains', PermissionsEnum.CHANNELS_VIEW],
			['channelDomain', PermissionsEnum.CHANNELS_VIEW],
			['createChannelDomain', PermissionsEnum.CHANNELS_EDIT],
			['updateChannelDomain', PermissionsEnum.CHANNELS_EDIT],
			['deleteChannelDomain', PermissionsEnum.CHANNELS_EDIT],
			['verifyChannelDomain', PermissionsEnum.CHANNELS_EDIT]
		];

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ChannelDomainResolver.prototype;

		for (const field of ['createChannelDomain', 'updateChannelDomain', 'deleteChannelDomain', 'verifyChannelDomain']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CHANNELS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});
