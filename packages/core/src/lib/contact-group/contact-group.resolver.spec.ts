/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { ContactGroupType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupResolver } from './contact-group.resolver';

/**
 * Contact groups over GraphQL (GraphQL specification §3.2 row 4, §3.1, §7.1–§7.2, §9.7).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and this
 * suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field the specification names for this resource exists **in the SDL**, read from the
 *   `.gql` files the boot loader globs rather than from a decorator, because a resolver whose field the
 *   schema does not declare is a field nothing can call;
 * - the list root field is a connection with the platform's own cursor codec behind it, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - a mutation delegates to the same service method the REST route calls, with the same scope — a client
 *   does not choose a better surface by choosing a protocol;
 * - the three writes carry the three separate permissions the catalogue assigns them, so a role that may
 *   create a group cannot delete one by asking GraphQL instead of REST;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GROUP = '00000000-0000-4000-8000-000000000060';
const OTHER_GROUP = '00000000-0000-4000-8000-000000000061';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: GROUP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Wholesale',
		code: 'WHOLESALE',
		type: ContactGroupType.STATIC,
		isSystem: false,
		discountPercent: 0.1,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_GROUP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Guests',
		code: 'GUESTS',
		type: ContactGroupType.RULE_BASED,
		isSystem: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const contactGroupService = {
		listGroups: jest.fn().mockResolvedValue(ROWS),
		findGroup: jest.fn().mockResolvedValue(ROWS[0]),
		findGroupOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createGroup: jest.fn().mockResolvedValue(ROWS[0]),
		updateGroup: jest.fn().mockResolvedValue(ROWS[0]),
		removeGroup: jest.fn().mockResolvedValue(ROWS[1])
	};

	return { contactGroupService, resolver: new ContactGroupResolver(contactGroupService as never) };
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/**
 * The composed schema, as text: the domain's own documents, the membership domain's, and the kernel's —
 * exactly the set the boot loader globs and the composition pass asserts. The membership document is
 * included because the group type carries the pivot's two fields and references its type.
 */
function composedSchema(): string {
	const directories = [
		join(__dirname, 'schema'),
		join(__dirname, '..', 'contact-group-member', 'schema'),
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

describe('ContactGroupResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the two group queries', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['contactGroups', 'contactGroup']));
	});

	it('declares every group mutation the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createContactGroup', 'updateContactGroup', 'deleteContactGroup'])
		);
	});

	it('declares the membership of a group as fields of the group rather than as a root', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/members: \[ContactGroupMember!\]/);
		expect(printed).toMatch(/memberCount: Int!/);
		// The pivot is a child of the group: it has no node query of its own, which is the graph rather
		// than a gap — a membership has no meaning without the group it belongs to.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactGroupMembers']));
	});

	it('declares the group connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ContactGroupConnection \{\s*nodes: \[ContactGroup!\]!\s*edges: \[ContactGroupEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ContactGroupEdge \{\s*node: ContactGroup!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ContactGroupFilter \{/);
		expect(printed).toMatch(/input ContactGroupSort \{/);
		expect(printed).toMatch(/enum ContactGroupSortField \{/);
		expect(printed).toMatch(/input ContactGroupTypeFilter \{/);
		// The kernel's page info is referenced, never redeclared: the schema builds rather than fails when
		// the same name is declared twice, and the composition check is what refuses it.
		expect(printed).toMatch(/type PageInfo \{/);
	});

	it('declares no root field for the capabilities this delivery cannot honour', () => {
		const printed = printSchema(schema);

		// The segment evaluation the preview would need, and the rule type the expansion would return,
		// are both undelivered: a root field that promised either would be a field that cannot resolve.
		expect(rootFields('Mutation')).not.toEqual(expect.arrayContaining(['previewContactGroupMembers']));
		expect(printed).not.toMatch(/previewContactGroup/);
	});
});

describe('ContactGroupResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, contactGroupService } = surfaces();

		const connection = await resolver.contactGroups(undefined, undefined, undefined, 20);

		expect(contactGroupService.listGroups).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(GROUP);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactGroups({ type: { eq: ContactGroupType.RULE_BASED } });

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_GROUP]);
		// The total is the filtered total, which is what the REST envelope reports as `total`.
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactGroups(undefined, [{ field: 'name', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.code)).toEqual(['GUESTS', 'WHOLESALE']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.contactGroups(undefined, undefined, undefined, 1);

		const second = await resolver.contactGroups(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_GROUP]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactGroups(undefined, [{ field: 'priceListId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contactGroups({ rules: { eq: 'x' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactGroups(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contactGroups(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactGroupResolver — one concept, two protocols, the same writes', () => {
	it('reads one group, answering null rather than failing when there is none', async () => {
		const { resolver, contactGroupService } = surfaces();

		await expect(resolver.contactGroup(GROUP)).resolves.toBe(ROWS[0]);
		contactGroupService.findGroup.mockResolvedValueOnce(null);
		await expect(resolver.contactGroup(GROUP)).resolves.toBeNull();
	});

	it('creates, updates and removes through the same service methods the REST routes call', async () => {
		const { resolver, contactGroupService } = surfaces();

		await resolver.createContactGroup({ organizationId: ORGANIZATION, name: 'Wholesale', code: 'WHOLESALE' });
		await resolver.updateContactGroup({ id: GROUP, name: 'Renamed' });
		await resolver.deleteContactGroup(OTHER_GROUP);

		expect(contactGroupService.createGroup).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Wholesale', code: 'WHOLESALE' })
		);
		expect(contactGroupService.updateGroup).toHaveBeenCalledWith(GROUP, expect.objectContaining({ name: 'Renamed' }));
		expect(contactGroupService.removeGroup).toHaveBeenCalledWith(OTHER_GROUP);
	});

	it('surfaces a refusal of a system group as a 4xx that is not a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_SYSTEM: 'GUESTS' is a group the platform maintains, and it is not deletable."
		);
		const contactGroupService = {
			listGroups: jest.fn().mockResolvedValue(ROWS),
			removeGroup: jest.fn().mockRejectedValue(refusal)
		};
		const resolver = new ContactGroupResolver(contactGroupService as never);

		const error = await resolver.deleteContactGroup(OTHER_GROUP).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_SYSTEM');
	});
});

describe('ContactGroupResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the catalogue’s permission on every write', () => {
		const proto = ContactGroupResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['contactGroups', PermissionsEnum.CONTACT_GROUPS_VIEW],
			['contactGroup', PermissionsEnum.CONTACT_GROUPS_VIEW],
			['createContactGroup', PermissionsEnum.CONTACT_GROUPS_CREATE],
			['updateContactGroup', PermissionsEnum.CONTACT_GROUPS_EDIT],
			['deleteContactGroup', PermissionsEnum.CONTACT_GROUPS_DELETE]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactGroupResolver)).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write field
		// that carried the read permission — or none — would be reachable by every caller that may look.
		const proto = ContactGroupResolver.prototype;

		for (const field of ['createContactGroup', 'updateContactGroup', 'deleteContactGroup']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CONTACT_GROUPS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('offers no argument it cannot honour', () => {
		const printed = printSchema(schema);

		expect(printed).not.toMatch(/contactGroups\([^)]*withDeleted/);
	});
});
