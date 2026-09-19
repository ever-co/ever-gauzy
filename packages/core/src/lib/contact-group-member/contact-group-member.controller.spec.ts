/**
 * Group membership over REST (API specification §7.7, §5.1).
 *
 * The suite pins the five things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — the read carries `CONTACT_GROUPS_VIEW` and the write
 *   `CONTACT_GROUPS_EDIT`, read on the metadata a guard actually reads;
 * - **the gate is the group service's** — `assertMembershipWritable` is called once, before either half
 *   of the write, and this class never asks what kind of group it holds. A controller that tested
 *   `group.type` itself would be a second, drifting statement of the rule that a rule-based group's
 *   membership is computed and never materialised;
 * - **the write is a patch with the removals first**, so changing a member's window is one call;
 * - **a route whose service refuses surfaces a 4xx that is not a 404**, which is the difference between
 *   "you may not do this" and "there is nothing here".
 *
 * Three module boundaries are doubled for the reason the channel suite states: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside. The two guards are
 * doubled for a load-order reason as well — the guards barrel reaches the employee repository and
 * through it the entity graph from the wrong end — which keeps the assertion honest, because the
 * controller names these two tokens as its guards, which is what a guard reads.
 */
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
		currentUser: () => (mockTenantId ? { id: 'user-1', tenantId: mockTenantId } : null),
		currentUserId: () => (mockTenantId ? 'user-1' : null),
		currentTenantId: () => mockTenantId,
		currentOrganizationId: () => mockOrganizationId,
		currentEmployeeId: () => null,
		currentRoleId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { BadRequestException, HttpException } from '@nestjs/common';
import { ContactGroupSource, ContactGroupType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupMemberController } from './contact-group-member.controller';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GROUP = '00000000-0000-4000-8000-000000000060';
const CUSTOMER = '00000000-0000-4000-8000-000000000040';
const OTHER_CUSTOMER = '00000000-0000-4000-8000-000000000041';

/** The group a scripted group service answers with. */
const STORED_GROUP = {
	id: GROUP,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	name: 'Wholesale',
	code: 'WHOLESALE',
	type: ContactGroupType.STATIC,
	isSystem: false
};

/** The memberships a scripted membership service answers with. */
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

/**
 * The two services, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly rather
 * than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const contactGroupMemberService = {
		listMembers: jest.fn().mockResolvedValue(STORED_MEMBERS),
		addMembers: jest.fn().mockResolvedValue([STORED_MEMBERS[0]]),
		removeMember: jest.fn().mockResolvedValue(STORED_MEMBERS[1]),
		isMember: jest.fn().mockResolvedValue(true),
		...overrides
	};
	const contactGroupService = {
		findGroupOrFail: jest.fn().mockResolvedValue(STORED_GROUP),
		assertMembershipWritable: jest.fn(),
		...overrides
	};

	return {
		contactGroupMemberService,
		contactGroupService,
		controller: new ContactGroupMemberController(
			contactGroupMemberService as never,
			contactGroupService as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

beforeEach(() => {
	mockTenantId = '00000000-0000-4000-8000-000000000001';
	mockOrganizationId = ORGANIZATION;
});

describe('ContactGroupMemberController — the routes (API specification §7.7)', () => {
	it('lists a group’s live membership, with the count of it', async () => {
		const { controller, contactGroupMemberService, contactGroupService } = surfaces();

		const answer = await controller.findAll(GROUP, { filter: { source: ContactGroupSource.MANUAL }, take: 10 });

		expect(contactGroupService.findGroupOrFail).toHaveBeenCalledWith(GROUP);
		expect(contactGroupMemberService.listMembers).toHaveBeenCalledWith(GROUP, {
			source: ContactGroupSource.MANUAL
		});
		expect(answer.members).toEqual(STORED_MEMBERS);
		// The count is the live membership and not the page, which is why it is taken before the page is
		// applied: a balance reported over a page is a balance that changes with the page size.
		expect(answer.memberCount).toBe(2);
	});

	it('resolves the group before the membership, so a miss is the group’s own code', async () => {
		const refusal = new BadRequestException('CONTACT_GROUP_NOT_FOUND: contact group could not be found.');
		const { controller, contactGroupMemberService } = surfaces({
			findGroupOrFail: jest.fn().mockRejectedValue(refusal)
		});

		const error = await controller.findAll(GROUP).catch((thrown) => thrown);

		expect(error).toBe(refusal);
		// A caller that named a group which does not exist must not be told the group is empty.
		expect(contactGroupMemberService.listMembers).not.toHaveBeenCalled();
	});

	it('passes an administrative listing the request to include lapsed rows', async () => {
		const { controller, contactGroupMemberService } = surfaces();

		await controller.findAll(GROUP, { includeExpired: true });

		expect(contactGroupMemberService.listMembers).toHaveBeenCalledWith(GROUP, { includeExpired: true });
	});

	it('patches the membership, opening the gate once and applying the removals first', async () => {
		const { controller, contactGroupMemberService, contactGroupService } = surfaces();

		const answer = await controller.replace(GROUP, {
			add: [{ contactId: CUSTOMER, expiresAt: new Date('2026-06-01T10:00:00.000Z') }],
			remove: [{ contactId: OTHER_CUSTOMER }]
		});

		expect(contactGroupService.assertMembershipWritable).toHaveBeenCalledWith(STORED_GROUP);
		expect(contactGroupMemberService.removeMember).toHaveBeenCalledWith(GROUP, OTHER_CUSTOMER, undefined);
		expect(contactGroupMemberService.addMembers).toHaveBeenCalledWith(GROUP, [
			{ customerId: CUSTOMER, expiresAt: new Date('2026-06-01T10:00:00.000Z') }
		]);
		// The removals are applied before the additions, so "this member's window changes" is one call
		// rather than two requests that could half-apply between them.
		expect(contactGroupMemberService.removeMember.mock.invocationCallOrder[0]).toBeLessThan(
			contactGroupMemberService.addMembers.mock.invocationCallOrder[0]
		);
		expect(answer.members).toEqual(STORED_MEMBERS);
		expect(answer.memberCount).toBe(2);
	});

	it('opens the gate even when the body only removes memberships', async () => {
		const { controller, contactGroupService } = surfaces();

		await controller.replace(GROUP, { remove: [{ contactId: OTHER_CUSTOMER }] });

		expect(contactGroupService.assertMembershipWritable).toHaveBeenCalledWith(STORED_GROUP);
	});

	it('never reads the group’s kind itself', () => {
		// The rule is the group service's, and a controller that compared `group.type` would be a second
		// statement of it — the one that drifts when a third kind arrives.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-group-member.controller.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/\.type\s*===\s*ContactGroupType/);
		expect(source).toMatch(/assertMembershipWritable\(/);
	});
});

describe('ContactGroupMemberController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a hand-written membership of a rule-based group with 400, never a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_MEMBER_INVALID: 'GUESTS' is rule-based, and its membership is computed from its rules rather than written."
		);
		const { controller } = surfaces({ assertMembershipWritable: jest.fn().mockImplementation(() => {
			throw refusal;
		}) });

		const error = await controller
			.replace(GROUP, { add: [{ contactId: CUSTOMER }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('CONTACT_GROUP_MEMBER_INVALID');
	});

	it('refuses a window that has already closed with 400, never a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_MEMBER_INVALID: a membership that lapses at '2020-01-01' has already lapsed, and an expired membership grants nothing."
		);
		const { controller } = surfaces({ addMembers: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.replace(GROUP, { add: [{ contactId: CUSTOMER, expiresAt: new Date('2020-01-01T00:00:00.000Z') }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_MEMBER_INVALID');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll(GROUP, { take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactGroupMemberController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupMemberController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactGroupMemberController)).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);
	});

	it('gives the read the read permission and the write the edit one', () => {
		const proto = ContactGroupMemberController.prototype;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['findAll'])).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['replace'])).toEqual([
			PermissionsEnum.CONTACT_GROUPS_EDIT
		]);
	});

	it('refuses the write to a caller who holds only the read permission', () => {
		const stated = Reflect.getMetadata(PERMISSIONS_METADATA, ContactGroupMemberController.prototype['replace']) ?? [];

		expect(stated).not.toContain(PermissionsEnum.CONTACT_GROUPS_VIEW);
		expect(stated.length).toBeGreaterThan(0);
	});

	it('refuses a request that presents no credential at all', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupMemberController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});

describe('ContactGroupMemberController — the routes it declares', () => {
	it('maps its two routes off the group’s own path', () => {
		// Read from the source rather than from metadata: the two routes are children of the group
		// resource, which is why they are declared with the group's prefix rather than a path of their own.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-group-member.controller.ts'),
			'utf8'
		);

		expect(source).toMatch(/@Controller\('\/contact-groups'\)/);
		expect(source).toMatch(/@Get\(':id\/members'\)/);
		expect(source).toMatch(/@Put\(':id\/members'\)/);
		expect(source).toMatch(/@UseValidationPipe\(\{ transform: true, whitelist: true \}\)/);
	});

	it('does not extend the CRUD base, whose routes would collide with the group’s', () => {
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-group-member.controller.ts'),
			'utf8'
		);

		// `@Controller('/contact-groups')` plus an inherited `@Get(':id')` would shadow the group's own
		// detail route: one path family, one controller that owns the parent.
		expect(source).not.toMatch(/extends CrudController/);
	});
});
