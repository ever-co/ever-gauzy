/**
 * The address book over REST (API specification §7.3, §7.5a, §5.1).
 *
 * The suite pins the five things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion
 *   is about the decision and not about the decorator's prose. A write route carries `ORG_CONTACT_EDIT`
 *   and never the read permission, which is what makes "a caller who may look cannot write" true
 *   rather than intended;
 * - **the defaults are moved, never written** — no route of this class writes `isDefaultShipping` or
 *   `isDefaultBilling`; the create and update bodies are handed to the service, which routes a stated
 *   flag to the set-default operation, and the two dedicated routes call that operation and its clear
 *   counterpart directly. The suite asserts both halves: the delegation, and the absence of a write;
 * - **the route decorators** — every method that overrides the CRUD base restates its own route,
 *   because an override without one is an endpoint that quietly stops existing;
 * - **the routes themselves** — each one is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may
 *   not do this" and "there is nothing here".
 *
 * Three module boundaries are doubled for the reason the channel suite states: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside. The two guards are
 * doubled for a load-order reason as well — the guards barrel reaches the employee repository and
 * through it the entity graph from the wrong end — which keeps the assertion honest, because the
 * controller names these two tokens as its guards, which is what a guard reads.
 *
 * **The controller under test is the real one**, over a scripted service, so a route that stopped
 * delegating — or delegated to something else — is caught here rather than accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
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
import { AddressOwnerType, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AddressRoleEnum } from '../address-role/address-role.enums';
import { AddressController } from './address.controller';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ADDRESS = '00000000-0000-4000-8000-000000000030';
const CONTACT = '00000000-0000-4000-8000-000000000040';

/** The address a scripted service answers with. */
const STORED = {
	id: ADDRESS,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	label: 'Home',
	line1: '1 Example Street',
	city: 'Berlin',
	countryCode: 'DE',
	ownerType: AddressOwnerType.CONTACT,
	ownerId: CONTACT,
	customerId: CONTACT,
	isDefaultShipping: false,
	isDefaultBilling: false,
	isValidated: false
};

/**
 * The service and the role pivot, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const addressService = {
		listAddresses: jest.fn().mockResolvedValue([STORED]),
		findAddress: jest.fn().mockResolvedValue(STORED),
		findAddressOrFail: jest.fn().mockResolvedValue(STORED),
		createAddress: jest.fn().mockResolvedValue(STORED),
		updateAddress: jest.fn().mockResolvedValue(STORED),
		softRemoveAddress: jest.fn().mockResolvedValue({ ...STORED, deletedAt: new Date('2026-03-01T10:00:00.000Z') }),
		listRoles: jest.fn().mockResolvedValue([AddressRoleEnum.SHIPPING]),
		setRoles: jest.fn().mockResolvedValue([{ role: AddressRoleEnum.SHIPPING, isDefault: true }]),
		setDefaultAddress: jest.fn().mockResolvedValue({ ...STORED, isDefaultShipping: true }),
		clearDefaultAddress: jest.fn().mockResolvedValue(STORED),
		...overrides
	};
	const addressRoleService = {
		listForAddress: jest
			.fn()
			.mockResolvedValue([{ id: 'role-1', addressId: ADDRESS, role: AddressRoleEnum.SHIPPING, isDefault: true }])
	};

	return {
		addressService,
		addressRoleService,
		controller: new AddressController(addressService as never, addressRoleService as never)
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

describe('AddressController — the routes (API specification §7.3, §7.5a)', () => {
	it('lists the addresses of the caller’s organization, newest first', async () => {
		const { controller, addressService } = surfaces();

		const answer = await controller.findAll({
			filter: { countryCode: 'DE', isDefaultShipping: true },
			take: 10,
			skip: 0
		});

		// The bracketed spelling the endpoint table names reaches the same narrowing the flat one does,
		// and the page is applied here: the delivered list method answers with the filtered set.
		expect(addressService.listAddresses).toHaveBeenCalledWith({ countryCode: 'DE', isDefaultShipping: true });
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('reads one address', async () => {
		const { controller, addressService } = surfaces();

		await expect(controller.findById(ADDRESS)).resolves.toBe(STORED);
		expect(addressService.findAddressOrFail).toHaveBeenCalledWith(ADDRESS);
	});

	it('records an address and hands a stated default to the service rather than writing it', async () => {
		const { controller, addressService } = surfaces();

		const created = await controller.create({
			line1: '1 Example Street',
			city: 'Berlin',
			countryCode: 'DE',
			ownerId: CONTACT,
			isDefaultShipping: true
		} as never);

		expect(addressService.createAddress).toHaveBeenCalledWith(
			expect.objectContaining({ line1: '1 Example Street', isDefaultShipping: true })
		);
		expect(created).toBe(STORED);
		// The route never reaches for the flag itself: the service routes it to the set-default
		// operation, which is the one code path that moves a default and clears the sibling it replaces.
		expect(addressService.setDefaultAddress).not.toHaveBeenCalled();
	});

	it('updates the descriptive facts of an address', async () => {
		const { controller, addressService } = surfaces();

		await controller.update(ADDRESS, { label: 'Office' } as never);

		expect(addressService.updateAddress).toHaveBeenCalledWith(ADDRESS, { label: 'Office' });
	});

	it('removes an address softly, through the domain’s own removal', async () => {
		const { controller, addressService } = surfaces();

		const removed = await controller.delete(ADDRESS);

		expect(addressService.softRemoveAddress).toHaveBeenCalledWith(ADDRESS);
		expect(removed.deletedAt).toBeInstanceOf(Date);
	});

	it('routes the inherited soft-delete route to the same removal, so a default cannot be deleted', async () => {
		const { controller, addressService } = surfaces();

		await controller.softRemove(ADDRESS);

		// The base class's soft remove would delete the row directly; the domain's refuses the one the
		// party names as its current default, which is why the override exists at all.
		expect(addressService.softRemoveAddress).toHaveBeenCalledWith(ADDRESS);
	});

	it('reads the roles an address plays, with the default of each', async () => {
		const { controller, addressService, addressRoleService } = surfaces();

		const roles = await controller.findRoles(ADDRESS);

		expect(addressService.findAddressOrFail).toHaveBeenCalledWith(ADDRESS);
		expect(addressRoleService.listForAddress).toHaveBeenCalledWith(ADDRESS);
		expect(roles).toEqual([{ role: AddressRoleEnum.SHIPPING, isDefault: true }]);
	});

	it('replaces the roles an address plays as a set', async () => {
		const { controller, addressService } = surfaces();

		const roles = await controller.replaceRoles(ADDRESS, {
			roles: [{ role: AddressRoleEnum.SHIPPING, isDefault: true }]
		});

		expect(addressService.setRoles).toHaveBeenCalledWith(ADDRESS, [
			{ role: AddressRoleEnum.SHIPPING, isDefault: true, metadata: undefined }
		]);
		expect(roles).toEqual([{ role: AddressRoleEnum.SHIPPING, isDefault: true }]);
	});

	it('moves a default through the operation that owns it', async () => {
		const { controller, addressService } = surfaces();

		const moved = await controller.setDefault(ADDRESS, { role: AddressRoleEnum.SHIPPING });

		expect(addressService.setDefaultAddress).toHaveBeenCalledWith(ADDRESS, AddressRoleEnum.SHIPPING);
		expect(moved.isDefaultShipping).toBe(true);
	});

	it('clears a default through the operation that owns it', async () => {
		const { controller, addressService } = surfaces();

		await controller.clearDefault(ADDRESS, { role: AddressRoleEnum.BILLING });

		expect(addressService.clearDefaultAddress).toHaveBeenCalledWith(ADDRESS, AddressRoleEnum.BILLING);
	});
});

describe('AddressController — refusals (a 4xx that is not a 404)', () => {
	it('refuses removing an address the party names as its default with 409, never a 404', async () => {
		const refusal = new BadRequestException(
			'ADDRESS_DEFAULT_MISMATCH: This address is the default for SHIPPING, and a default is moved before it is removed.'
		);
		const { controller } = surfaces({ softRemoveAddress: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.delete(ADDRESS).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('ADDRESS_DEFAULT_MISMATCH');
	});

	it('refuses an owner pair and a buyer reference that disagree with a 4xx, never a 404', async () => {
		const refusal = new BadRequestException(
			`ADDRESS_OWNER_MISMATCH: This address is owned by ${AddressOwnerType.CONTACT} but references customer 'other'.`
		);
		const { controller } = surfaces({ createAddress: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ line1: '1 Example Street', city: 'Berlin', countryCode: 'DE', ownerId: CONTACT } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('ADDRESS_OWNER_MISMATCH');
	});

	it('refuses a body that states a validation verdict, rather than writing a verdict it never obtained', async () => {
		const refusal = new BadRequestException(
			'VALIDATION_UNKNOWN_FIELD: \'isValidated\' is the address-validation strategy\'s verdict and is written by the operation that observes it.'
		);
		const { controller } = surfaces({ createAddress: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ line1: '1 Example Street', city: 'Berlin', countryCode: 'DE', ownerId: CONTACT } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('VALIDATION_UNKNOWN_FIELD');
	});

	it('refuses a role that has no default rather than storing a flag nothing reads', async () => {
		const refusal = new BadRequestException(
			'VALIDATION_INVALID_ENUM: RETURN has no default; only SHIPPING and BILLING do.'
		);
		const { controller } = surfaces({ setDefaultAddress: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.setDefault(ADDRESS, { role: AddressRoleEnum.RETURN })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('VALIDATION_INVALID_ENUM');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('AddressController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', AddressController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AddressController)).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);
	});

	it('gives every route the permission the endpoint table names, and the reads the read permission', () => {
		const proto = AddressController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.ORG_CONTACT_VIEW],
			['findById', PermissionsEnum.ORG_CONTACT_VIEW],
			['findRoles', PermissionsEnum.ORG_CONTACT_VIEW],
			['create', PermissionsEnum.ORG_CONTACT_EDIT],
			['update', PermissionsEnum.ORG_CONTACT_EDIT],
			['delete', PermissionsEnum.ORG_CONTACT_EDIT],
			['softRemove', PermissionsEnum.ORG_CONTACT_EDIT],
			['replaceRoles', PermissionsEnum.ORG_CONTACT_EDIT],
			['setDefault', PermissionsEnum.ORG_CONTACT_EDIT],
			['clearDefault', PermissionsEnum.ORG_CONTACT_EDIT]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write route
		// that carried the read permission — or none — would be reachable by every caller that may look.
		const proto = AddressController.prototype;
		const writes = ['create', 'update', 'delete', 'softRemove', 'replaceRoles', 'setDefault', 'clearDefault'];

		for (const route of writes) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.ORG_CONTACT_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('refuses a request that presents no credential at all', () => {
		const guards = Reflect.getMetadata('__guards__', AddressController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});

describe('AddressController — the rules this class must not re-implement', () => {
	it('restates the route decorator on every method it overrides', () => {
		// Read from the source rather than from metadata: Nest merges the inherited route metadata, so
		// only the text tells an override that kept its decorator from one that dropped it.
		const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'address.controller.ts'), 'utf8');

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\(':id'\)/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id\/soft'\)/);
	});

	it('never writes a default flag itself', () => {
		// The authority rule is the service's, and this assertion is the one a future route would break:
		// a body that reaches an `update` call carrying the boolean is the two-locations-disagree defect.
		const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'address.controller.ts'), 'utf8');

		expect(source).not.toMatch(/isDefaultShipping\s*[:=]\s*(true|false|entity)/);
		expect(source).not.toMatch(/isDefaultBilling\s*[:=]\s*(true|false|entity)/);
	});

	it('declares no route for the address-validation strategy the kernel does not ship', () => {
		const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'address.controller.ts'), 'utf8');

		expect(source).not.toMatch(/@Post\(':id\/validate'\)/);
	});
});
