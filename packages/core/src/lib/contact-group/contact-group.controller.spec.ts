/**
 * Contact groups over REST (API specification §7.7, §5.1, appendix B).
 *
 * The suite pins the five things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion is
 *   about the decision and not about the decorator's prose. The three writes carry the three separate
 *   permissions the catalogue assigns them, which is what makes "a role that may create a group cannot
 *   delete one" true rather than intended;
 * - **the refusal of an expansion this resource does not offer** — the endpoint table names
 *   `expand=rules,members`, no relation of it is reachable from this module, and the request is answered
 *   with the query protocol's own `QUERY_EXPAND_NOT_ALLOWED` rather than being silently stripped;
 * - **the route decorators** — every method that overrides the CRUD base restates its own route, because
 *   an override without one is an endpoint that quietly stops existing;
 * - **the routes themselves** — each one is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may not
 *   do this" and "there is nothing here".
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

import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { ContactGroupType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CrudController } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupController } from './contact-group.controller';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GROUP = '00000000-0000-4000-8000-000000000060';

/** The group a scripted service answers with. */
const STORED = {
	id: GROUP,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	name: 'Wholesale',
	code: 'WHOLESALE',
	type: ContactGroupType.STATIC,
	isSystem: false,
	discountPercent: 0.1
};

/**
 * The service, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly rather
 * than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const contactGroupService = {
		listGroups: jest.fn().mockResolvedValue([STORED]),
		findGroup: jest.fn().mockResolvedValue(STORED),
		findGroupOrFail: jest.fn().mockResolvedValue(STORED),
		findGroupByCode: jest.fn().mockResolvedValue(STORED),
		createGroup: jest.fn().mockResolvedValue(STORED),
		updateGroup: jest.fn().mockResolvedValue(STORED),
		removeGroup: jest.fn().mockResolvedValue({ ...STORED, deletedAt: new Date('2026-03-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...STORED, deletedAt: null }),
		assertMembershipWritable: jest.fn(),
		...overrides
	};

	return { contactGroupService, controller: new ContactGroupController(contactGroupService as never) };
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

beforeEach(() => {
	mockTenantId = '00000000-0000-4000-8000-000000000001';
	mockOrganizationId = ORGANIZATION;
});

describe('ContactGroupController — the routes (API specification §7.7)', () => {
	it('lists the groups of the caller’s organization, newest first', async () => {
		const { controller, contactGroupService } = surfaces();

		const answer = await controller.findAll({ filter: { type: ContactGroupType.RULE_BASED }, take: 10, skip: 0 });

		// The bracketed spelling the endpoint table names reaches the same narrowing the flat one does,
		// and the page is applied here: the delivered list method answers with the filtered set.
		expect(contactGroupService.listGroups).toHaveBeenCalledWith({ type: ContactGroupType.RULE_BASED });
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('narrows by the free text under either of its spellings', async () => {
		const { controller, contactGroupService } = surfaces();

		await controller.findAll({ q: 'whole' });

		expect(contactGroupService.listGroups).toHaveBeenCalledWith({ search: 'whole' });
	});

	it('reads one group', async () => {
		const { controller, contactGroupService } = surfaces();

		await expect(controller.findById(GROUP)).resolves.toBe(STORED);
		expect(contactGroupService.findGroupOrFail).toHaveBeenCalledWith(GROUP);
	});

	it('creates a group an operator maintains', async () => {
		const { controller, contactGroupService } = surfaces();

		const created = await controller.create({ name: 'Wholesale', code: 'WHOLESALE' } as never);

		expect(contactGroupService.createGroup).toHaveBeenCalledWith({ name: 'Wholesale', code: 'WHOLESALE' });
		expect(created).toBe(STORED);
	});

	it('changes a group’s descriptive facts and its kind', async () => {
		const { controller, contactGroupService } = surfaces();

		await controller.update(GROUP, { type: ContactGroupType.RULE_BASED } as never);

		// The member count the service takes is left to its own default: the pivot's service lives in a
		// module that imports this one, so this controller cannot resolve it.
		expect(contactGroupService.updateGroup).toHaveBeenCalledWith(GROUP, { type: ContactGroupType.RULE_BASED });
	});

	it('removes a group softly, through the domain’s own removal', async () => {
		const { controller, contactGroupService } = surfaces();

		const removed = await controller.delete(GROUP);

		expect(contactGroupService.removeGroup).toHaveBeenCalledWith(GROUP);
		expect(removed.deletedAt).toBeInstanceOf(Date);
	});

	it('routes the inherited soft-delete route to the same removal, so a system group cannot be removed', async () => {
		const { controller, contactGroupService } = surfaces();

		await controller.softRemove(GROUP);

		// The base class's soft remove would delete the row directly; the domain's refuses a group the
		// platform maintains, which is why the override exists at all.
		expect(contactGroupService.removeGroup).toHaveBeenCalledWith(GROUP);
	});

	it('restores a withdrawn group through the same service method the inherited route called', async () => {
		const { controller, contactGroupService } = surfaces();

		const restored = await controller.softRecover(GROUP);

		// The override exists only to state the route's permission, so it reaches exactly what the base
		// handler reached — and never the domain's removal.
		expect(contactGroupService.softRecover).toHaveBeenCalledWith(GROUP);
		expect(contactGroupService.removeGroup).not.toHaveBeenCalled();
		expect(restored.deletedAt).toBeNull();
		// An override replaces the inherited method's metadata, so the status code is restated: a client
		// of the delivered route still reads the 202 the CRUD base answers.
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, ContactGroupController.prototype.softRecover)).toBe(
			HttpStatus.ACCEPTED
		);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, CrudController.prototype.softRecover)).toBe(HttpStatus.ACCEPTED);
	});

	it('refuses an expansion this resource does not offer, with the query protocol’s own code', async () => {
		const { controller, contactGroupService } = surfaces();

		const error = await controller.findAll({ expand: ['rules', 'members'] }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_EXPAND_NOT_ALLOWED');
		// The refusal happens before the read: a caller learns why rather than receiving a page it
		// believes was expanded.
		expect(contactGroupService.listGroups).not.toHaveBeenCalled();
	});

	it('lists without an expansion as an ordinary read', async () => {
		const { controller, contactGroupService } = surfaces();

		await controller.findAll({ expand: [] });

		expect(contactGroupService.listGroups).toHaveBeenCalled();
	});
});

describe('ContactGroupController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a duplicate code with 400, and the refusal names the catalogue code', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_CODE_TAKEN: 'WHOLESALE' is already used by a group of this organization, and a code addresses one group."
		);
		const { controller } = surfaces({ createGroup: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.create({ name: 'Wholesale', code: 'WHOLESALE' } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('CONTACT_GROUP_CODE_TAKEN');
	});

	it('refuses a code that is blank once trimmed, rather than storing a key nobody can address', async () => {
		const refusal = new BadRequestException(
			'CONTACT_GROUP_INVALID: a group is stated with the code it will be addressed by, and none was presented.'
		);
		const { controller } = surfaces({ createGroup: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.create({ name: 'Wholesale', code: '   ' } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_INVALID');
	});

	it('refuses a discount that is a percentage rather than a fraction, rather than discounting by a thousand per cent', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_INVALID: a group discount is a fraction between 0 and 1 (0.1 is ten per cent), and '10' is not one."
		);
		const { controller } = surfaces({ createGroup: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ name: 'Wholesale', code: 'WHOLESALE', discountPercent: 10 } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_INVALID');
	});

	it('refuses removing a group the platform maintains with a 4xx, never a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_GROUP_SYSTEM: 'GUESTS' is a group the platform maintains, and it is not deletable."
		);
		const { controller } = surfaces({ removeGroup: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.delete(GROUP).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_GROUP_SYSTEM');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactGroupController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactGroupController)).toEqual([
			PermissionsEnum.CONTACT_GROUPS_VIEW
		]);
	});

	it('gives every route the permission the catalogue assigns it, and the reads the read permission', () => {
		const proto = ContactGroupController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.CONTACT_GROUPS_VIEW],
			['findById', PermissionsEnum.CONTACT_GROUPS_VIEW],
			['create', PermissionsEnum.CONTACT_GROUPS_CREATE],
			['update', PermissionsEnum.CONTACT_GROUPS_EDIT],
			['delete', PermissionsEnum.CONTACT_GROUPS_DELETE],
			['softRemove', PermissionsEnum.CONTACT_GROUPS_DELETE],
			// Restoring undoes a removal, so it states the removal's grant. Left inherited, the route stated
			// none and stood on the class's `CONTACT_GROUPS_VIEW` (AWR-5).
			['softRecover', PermissionsEnum.CONTACT_GROUPS_DELETE]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write route
		// that carried the read permission — or none — would be reachable by every caller that may look.
		const proto = ContactGroupController.prototype;

		for (const route of ['create', 'update', 'delete', 'softRemove', 'softRecover']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CONTACT_GROUPS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('refuses a request that presents no credential at all', () => {
		const guards = Reflect.getMetadata('__guards__', ContactGroupController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});

describe('ContactGroupController — the routes the CRUD base supplies', () => {
	it('restates the route decorator on every method it overrides', () => {
		// Read from the source rather than from metadata: Nest merges the inherited route metadata, so
		// only the text tells an override that kept its decorator from one that dropped it.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-group.controller.ts'),
			'utf8'
		);

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\(':id'\)/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id\/soft'\)/);
		expect(source).toMatch(/@Put\(':id\/recover'\)\n\tasync softRecover\(/);
	});

	it('declares no route for the membership pivot, which its own module cannot reach', () => {
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-group.controller.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/@Put\(':id\/members'\)/);
		expect(source).not.toMatch(/@Post\(':id\/preview'\)/);
	});
});
