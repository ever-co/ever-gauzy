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
import { ContactGroupSource, ContactGroupType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupResolver } from './contact-group.resolver';
import {
	CONTACT_GROUP_EVENT_NAMES,
	CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES,
	ContactGroupEventPublisher,
	IContactGroupChangedEnvelope
} from './contact-group-event.publisher';

/**
 * The request context, doubled so the tenant a credential carries is a value this suite states.
 *
 * The subscription is the one field whose topic is built from the credential rather than from an
 * argument, so the tenant has to be knowable here for the assertion to be about the topic and not
 * about whichever tenant the ambient context happened to hold.
 */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => (mockTenantId ? { id: 'user-1', tenantId: mockTenantId } : null),
		currentUserId: () => (mockTenantId ? 'user-1' : null),
		currentTenantId: () => mockTenantId,
		currentOrganizationId: () => mockOrganizationId,
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

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
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const CUSTOMER = '00000000-0000-4000-8000-000000000040';

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

/** The resolver, over a scripted service and a fan-out that records the topic it was opened on. */
function surfaces() {
	const contactGroupService = {
		listGroups: jest.fn().mockResolvedValue(ROWS),
		findGroup: jest.fn().mockResolvedValue(ROWS[0]),
		findGroupOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createGroup: jest.fn().mockResolvedValue(ROWS[0]),
		updateGroup: jest.fn().mockResolvedValue(ROWS[0]),
		removeGroup: jest.fn().mockResolvedValue(ROWS[1])
	};
	const pubSub = {
		topicFor: jest.fn((eventName: string, tenantId: string) => `${eventName}:${tenantId}`),
		asyncIterableIterator: jest.fn().mockReturnValue('the contact group stream')
	};

	return {
		contactGroupService,
		pubSub,
		resolver: new ContactGroupResolver(contactGroupService as never, pubSub as never)
	};
}

/**
 * The deployment's own fan-out, with the real publisher over it.
 *
 * The publisher under test is the real one, because what this suite pins is the envelope a subscriber
 * receives and not that some collaborator was called: the fan-out is the platform's in-process engine,
 * so a fact published here is a fact the subscription's own stream hands back.
 */
function announcements() {
	const pubSub = new GraphqlPubSub();
	const catalogue = new SubscriptionCatalogue();
	const publisher = new ContactGroupEventPublisher(pubSub as never, catalogue);

	publisher.onModuleInit();

	return { pubSub, catalogue, publisher };
}

/**
 * Reads one message from a stream, refusing to hang the suite when none arrives.
 *
 * The deadline is cleared on every path, so a case that reads five messages leaves five timers behind
 * for a run that has already decided — which is what makes Jest force a worker to exit.
 */
async function nextOrNothing<T>(stream: AsyncIterator<T>): Promise<IteratorResult<T>> {
	let deadline: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			stream.next(),
			new Promise<IteratorResult<T>>((resolve) => {
				deadline = setTimeout(() => resolve({ value: undefined, done: true }), 50);
			})
		]);
	} finally {
		clearTimeout(deadline);
	}
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

beforeEach(() => {
	mockTenantId = TENANT;
	mockOrganizationId = ORGANIZATION;
});

describe('ContactGroupResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the two group queries', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['contactGroups', 'contactGroup']));
	});

	it('declares every group mutation the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createContactGroup', 'updateContactGroup', 'deleteContactGroup'])
		);
	});

	it('declares the subscription the coverage table promises, with its two narrowing arguments', () => {
		const printed = printSchema(schema);

		expect(rootFields('Subscription')).toEqual(expect.arrayContaining(['contactGroupChanged']));
		// The two arguments are the ones the channel subscription takes, narrowed to this concept: they
		// can only narrow the stream, and neither of them can name a tenant.
		expect(printed).toMatch(/contactGroupChanged\(groupId: ID, action: String\): ContactGroup!/);
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
		const resolver = new ContactGroupResolver(contactGroupService as never, surfaces().pubSub as never);

		const error = await resolver.deleteContactGroup(OTHER_GROUP).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_SYSTEM');
	});
});

describe('ContactGroupResolver — subscriptions (§10.2, §10.4)', () => {
	it('guards the subscription exactly as the resource’s reads are guarded, and never more widely', () => {
		const proto = ContactGroupResolver.prototype;
		const guards = Reflect.getMetadata('__guards__', ContactGroupResolver) ?? [];

		// A subscription is a read of the same resource, so it carries the class's guard chain and the
		// read permission: a caller who may not list groups may not watch them either, and a caller who
		// may list them needs nothing else to watch them.
		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto.contactGroupChanged)).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);
	});

	it('opens one topic per announced fact, each scoped to the tenant the credential carries', () => {
		const { resolver, pubSub } = surfaces();

		resolver.contactGroupChanged(GROUP, 'assigned');

		// The tenant is the credential's and never an argument's: the field takes `groupId` and
		// `action`, and neither of them can reach the topic this way.
		for (const eventName of CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES) {
			expect(pubSub.topicFor).toHaveBeenCalledWith(eventName, TENANT);
			expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(`${eventName}:${TENANT}`);
		}
	});

	it('subscribes to nothing when no tenant is resolved, rather than to every tenant’s facts', () => {
		mockTenantId = null;
		const { resolver, pubSub } = surfaces();

		resolver.contactGroupChanged();

		// The topic of an unauthenticated connection is one no fact is ever published on, so the stream
		// is silent rather than wide — which is the fail-closed answer the other domains give too.
		for (const eventName of CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES) {
			expect(pubSub.topicFor).toHaveBeenCalledWith(eventName, '');
		}
	});

	it('carries every producing write’s envelope on the stream the subscription resolves', async () => {
		const { pubSub, publisher } = announcements();
		const resolver = new ContactGroupResolver(surfaces().contactGroupService as never, pubSub as never);
		const stream = resolver.contactGroupChanged(GROUP)[Symbol.asyncIterator]();

		// The writes, as the services announce them: the group's own definition changing, and its
		// membership being granted and withdrawn.
		await publisher.groupChanged(ROWS[0], 'created');
		await publisher.groupChanged(ROWS[0], 'updated');
		await publisher.groupChanged(ROWS[1], 'deleted');
		await publisher.membersAssigned(ROWS[0], [CUSTOMER], ContactGroupSource.MANUAL);
		await publisher.membersUnassigned(ROWS[0], [CUSTOMER], ContactGroupSource.MANUAL);

		const received: IContactGroupChangedEnvelope[] = [];

		for (let index = 0; index < 5; index++) {
			const message = await nextOrNothing(stream);

			expect(message.done).toBe(false);
			received.push(message.value);
		}

		await stream.return?.(undefined);

		// Every producing write reached the one stream the field returns. The order is asserted as a set
		// rather than as a sequence: each topic preserves its own order, and the merge makes no promise
		// across topics — which is the platform's own rule for facts of different partitions.
		expect(received.map((envelope) => `${envelope.name}:${envelope.action}`).sort()).toEqual(
			[
				`${CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED}:created`,
				`${CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED}:updated`,
				`${CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED}:deleted`,
				`${CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED}:assigned`,
				`${CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_UNASSIGNED}:unassigned`
			].sort()
		);

		// The envelope is the platform's own, with the scoping members the delivery decision is made on
		// and the aggregate the facts belong to.
		for (const envelope of received) {
			expect(envelope.tenantId).toBe(TENANT);
			expect(envelope.organizationId).toBe(ORGANIZATION);
			expect(envelope.channelId).toBeNull();
			expect(envelope.aggregate.type).toBe('ContactGroup');
			expect(envelope.occurredAt).toBeInstanceOf(Date);
		}

		// A group's own change carries the row, and the two membership facts carry the catalogued
		// payload — `groupId`, `customerIds[]`, `source` — beside the group a subscriber resolves.
		const created = received.find((envelope) => envelope.action === 'created');
		const deleted = received.find((envelope) => envelope.action === 'deleted');
		const assigned = received.find((envelope) => envelope.action === 'assigned');
		const unassigned = received.find((envelope) => envelope.action === 'unassigned');

		expect(created.data).toBe(ROWS[0]);
		expect(created.group).toBe(ROWS[0]);
		expect(deleted.group).toBe(ROWS[1]);
		expect(assigned.data).toEqual({ groupId: GROUP, customerIds: [CUSTOMER], source: ContactGroupSource.MANUAL });
		expect(assigned.customerIds).toEqual([CUSTOMER]);
		expect(assigned.source).toBe(ContactGroupSource.MANUAL);
		expect(unassigned.data).toEqual({ groupId: GROUP, customerIds: [CUSTOMER], source: ContactGroupSource.MANUAL });
	});

	it('never delivers a fact produced for another tenant, whatever the topic it was published on', async () => {
		const { pubSub, publisher } = announcements();
		// No credential behind the write, so each fact travels on the topic its own row names — which is
		// what lets this case publish on both tenants' topics and read one of them.
		mockTenantId = null;

		const tenantStream = pubSub.asyncIterableIterator<IContactGroupChangedEnvelope>(
			pubSub.topicFor(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED, TENANT)
		);

		await publisher.groupChanged(ROWS[0], 'created');
		await publisher.groupChanged(
			{ ...ROWS[0], id: OTHER_GROUP, tenantId: OTHER_TENANT, organizationId: null },
			'created'
		);

		const received = await nextOrNothing(tenantStream);

		expect(received.done).toBe(false);
		expect(received.value.tenantId).toBe(TENANT);
		expect(received.value.group.id).toBe(GROUP);
		// The other tenant's fact travelled on `<event>:<other tenant>`, a topic this stream was never
		// given, so there is nothing left to filter and nothing to leak.
		expect(pubSub.topicFor(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED, OTHER_TENANT)).not.toBe(
			pubSub.topicFor(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED, TENANT)
		);

		await tenantStream.return?.(undefined);
	});

	it('declares every fact it carries, so the kernel’s own event selection can resolve them', () => {
		const { catalogue } = announcements();

		expect(catalogue.names()).toEqual([...CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES].sort());
		expect(catalogue.has(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED)).toBe(true);
		expect(catalogue.resolve(['contact_group.*'])).toEqual([...CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES].sort());
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
