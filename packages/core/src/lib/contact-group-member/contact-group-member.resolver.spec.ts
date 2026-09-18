/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { buildSchema } from 'graphql';
import { ContactGroupSource, ContactGroupType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupMemberResolver } from './contact-group-member.resolver';

/**
 * Group membership over GraphQL (GraphQL specification §3.2 row 4, §3.1, §9.7).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field the specification names for this domain exists **in the SDL**, read from the
 *   `.gql` files the boot loader globs rather than from a decorator;
 * - the membership of a group is a **field of the group**, resolved by the module that owns the pivot,
 *   and not a root field of its own — a membership has no meaning without its group;
 * - both mutations pass through `assertMembershipWritable`, which is the group service's gate: the rule
 *   that a rule-based group's membership is computed and never materialised is asked for rather than
 *   restated here;
 * - the count is the liveness-filtered membership and not a row count, because a membership whose window
 *   has closed is absent to every reader;
 * - the writes carry `CONTACT_GROUPS_EDIT` and never the read permission;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GROUP = '00000000-0000-4000-8000-000000000060';
const CUSTOMER = '00000000-0000-4000-8000-000000000040';
const OTHER_CUSTOMER = '00000000-0000-4000-8000-000000000041';

/** The group row the field resolvers receive as their parent. */
const GROUP_ROW = {
	id: GROUP,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	name: 'Wholesale',
	code: 'WHOLESALE',
	type: ContactGroupType.STATIC,
	isSystem: false
};

/** The live memberships a scripted service answers with. */
const STORED_MEMBERS = [
	{
		id: '00000000-0000-4000-8000-000000000070',
		groupId: GROUP,
		customerId: CUSTOMER,
		assignedAt: new Date('2026-03-01T10:00:00.000Z'),
		source: ContactGroupSource.MANUAL
	},
	{
		id: '00000000-0000-4000-8000-000000000071',
		groupId: GROUP,
		customerId: OTHER_CUSTOMER,
		assignedAt: new Date('2026-03-02T10:00:00.000Z'),
		source: ContactGroupSource.MANUAL
	}
];

/** The two services, scripted per field. */
function surfaces() {
	const contactGroupMemberService = {
		listMembers: jest.fn().mockResolvedValue(STORED_MEMBERS),
		addMembers: jest.fn().mockResolvedValue([STORED_MEMBERS[0]]),
		removeMember: jest.fn().mockResolvedValue(STORED_MEMBERS[1])
	};
	const contactGroupService = {
		findGroupOrFail: jest.fn().mockResolvedValue(GROUP_ROW),
		assertMembershipWritable: jest.fn()
	};

	return {
		contactGroupMemberService,
		contactGroupService,
		resolver: new ContactGroupMemberResolver(
			contactGroupMemberService as never,
			contactGroupService as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/**
 * The composed schema, as text: the membership domain's documents, the group domain's, and the kernel's —
 * exactly the set the boot loader globs and the composition pass asserts.
 */
function composedSchema(): string {
	const directories = [
		join(__dirname, 'schema'),
		join(__dirname, '..', 'contact-group', 'schema'),
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

describe('ContactGroupMemberResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the two membership mutations', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['addContactGroupMembers', 'removeContactGroupMembers'])
		);
	});

	it('declares no membership query root field, because the graph reaches it through the group', () => {
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['contactGroupMembers', 'contactGroupMember'])
		);
	});

	it('declares the membership type, its provenance enum and its inputs', () => {
		const printed = require('graphql').printSchema(schema);

		expect(printed).toMatch(/type ContactGroupMember \{/);
		expect(printed).toMatch(/enum ContactGroupSource \{/);
		expect(printed).toMatch(/input AddContactGroupMembersInput \{/);
		expect(printed).toMatch(/input RemoveContactGroupMembersInput \{/);
		expect(printed).toMatch(/input ContactGroupMemberInput \{/);
	});
});

describe('ContactGroupMemberResolver — the writes (§9.1)', () => {
	it('adds several memberships in one call, over the same service method the REST route calls', async () => {
		const { resolver, contactGroupMemberService } = surfaces();

		const stored = await resolver.addContactGroupMembers({
			groupId: GROUP,
			members: [{ contactId: CUSTOMER, expiresAt: new Date('2026-06-01T10:00:00.000Z') }]
		});

		expect(contactGroupMemberService.addMembers).toHaveBeenCalledWith(GROUP, [
			{ customerId: CUSTOMER, expiresAt: new Date('2026-06-01T10:00:00.000Z') }
		]);
		expect(stored).toEqual([STORED_MEMBERS[0]]);
	});

	it('removes memberships of the stated provenance, opening the gate before the first one', async () => {
		const { resolver, contactGroupMemberService, contactGroupService } = surfaces();

		const removed = await resolver.removeContactGroupMembers({
			groupId: GROUP,
			members: [{ contactId: OTHER_CUSTOMER, source: ContactGroupSource.MANUAL }]
		});

		expect(contactGroupService.findGroupOrFail).toHaveBeenCalledWith(GROUP);
		expect(contactGroupService.assertMembershipWritable).toHaveBeenCalledWith(GROUP_ROW);
		expect(contactGroupMemberService.removeMember).toHaveBeenCalledWith(
			GROUP,
			OTHER_CUSTOMER,
			ContactGroupSource.MANUAL
		);
		expect(removed).toEqual([STORED_MEMBERS[1]]);
		// The gate is opened before the first removal, not after it: a rule-based group refuses the write
		// whatever provenance the body names.
		expect(contactGroupService.assertMembershipWritable.mock.invocationCallOrder[0]).toBeLessThan(
			contactGroupMemberService.removeMember.mock.invocationCallOrder[0]
		);
	});

	it('surfaces the refusal of a rule-based group as a 4xx that is not a 404', async () => {
		// The add path is gated inside `addMembers`, which resolves the group and asks whether its kind
		// allows a hand-written membership; the refusal is the service's own and reaches the caller
		// unchanged, which is what makes it a 4xx rather than a miss.
		const refusal = new BadRequestException(
			"CONTACT_GROUP_MEMBER_INVALID: 'GUESTS' is rule-based, and its membership is computed from its rules rather than written."
		);
		const contactGroupMemberService = {
			addMembers: jest.fn().mockRejectedValue(refusal),
			removeMember: jest.fn()
		};
		const resolver = new ContactGroupMemberResolver(contactGroupMemberService as never, {} as never);

		const error = await resolver
			.addContactGroupMembers({ groupId: GROUP, members: [{ contactId: CUSTOMER }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_MEMBER_INVALID');
	});

	it('surfaces the same refusal on the removal path, where this resolver opens the gate itself', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_MEMBER_INVALID: 'GUESTS' is rule-based, and its membership is computed from its rules rather than written."
		);
		const contactGroupService = {
			findGroupOrFail: jest.fn().mockResolvedValue(GROUP_ROW),
			assertMembershipWritable: jest.fn().mockImplementation(() => {
				throw refusal;
			})
		};
		const contactGroupMemberService = { addMembers: jest.fn(), removeMember: jest.fn() };
		const resolver = new ContactGroupMemberResolver(
			contactGroupMemberService as never,
			contactGroupService as never
		);

		const error = await resolver
			.removeContactGroupMembers({ groupId: GROUP, members: [{ contactId: CUSTOMER }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect(contactGroupMemberService.removeMember).not.toHaveBeenCalled();
	});
});

describe('ContactGroupMemberResolver — the membership of a group, as fields of the group', () => {
	it('answers the live membership of the parent group', async () => {
		const { resolver, contactGroupMemberService } = surfaces();

		const members = await resolver.members(GROUP_ROW as never);

		expect(contactGroupMemberService.listMembers).toHaveBeenCalledWith(GROUP);
		expect(members).toEqual(STORED_MEMBERS);
	});

	it('answers the count from the liveness-filtered membership rather than from a row count', async () => {
		const { resolver, contactGroupMemberService } = surfaces();

		await expect(resolver.memberCount(GROUP_ROW as never)).resolves.toBe(2);
		// The service is the one that knows an expired row is absent; a `COUNT` over the table would
		// report members the platform does not have.
		expect(contactGroupMemberService.listMembers).toHaveBeenCalledWith(GROUP);
	});
});

describe('ContactGroupMemberResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupMemberResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the edit permission on every write', () => {
		const proto = ContactGroupMemberResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['addContactGroupMembers', PermissionsEnum.CONTACT_GROUPS_EDIT],
			['removeContactGroupMembers', PermissionsEnum.CONTACT_GROUPS_EDIT],
			['members', PermissionsEnum.CONTACT_GROUPS_VIEW],
			['memberCount', PermissionsEnum.CONTACT_GROUPS_VIEW]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactGroupMemberResolver)).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ContactGroupMemberResolver.prototype;

		for (const field of ['addContactGroupMembers', 'removeContactGroupMembers']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CONTACT_GROUPS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});
});
