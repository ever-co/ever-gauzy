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
import { buildSchema, printSchema } from 'graphql';
import { AddressOwnerType, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AddressRoleEnum } from '../address-role/address-role.enums';
import { AddressController } from './address.controller';
import { AddressResolver } from './address.resolver';

/**
 * The address book over GraphQL (GraphQL specification §3.2 row 4, §3.1, §7.1–§7.2, §9.7).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field the specification names for this resource exists **in the SDL**, read from the
 *   `.gql` files the boot loader globs rather than from a decorator, because a resolver whose field
 *   the schema does not declare is a field nothing can call;
 * - the list root field is a connection with the platform's own cursor codec behind it, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - every mutation delegates to the same service method the REST route calls, with the same scope — a
 *   client does not choose a better surface by choosing a protocol;
 * - **setting and clearing a default are one field**, and each direction reaches the one service
 *   method that owns it, so neither protocol offers a way to write the boolean directly;
 * - every write mutation carries `ORG_CONTACT_EDIT` and never the read permission, so a role that may
 *   look at the address book cannot change it by asking GraphQL instead of REST;
 * - **`recoverAddress` is the one write that carries the read grant**, because the inherited
 *   `PUT /:id/recover` route it mirrors states no permission of its own and the guard resolves the
 *   controller's class-level one for it — so the field is held to the controller's own metadata rather
 *   than to a second list that could agree with the resolver while disagreeing with the route;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ADDRESS = '00000000-0000-4000-8000-000000000030';
const OTHER_ADDRESS = '00000000-0000-4000-8000-000000000031';
const CONTACT = '00000000-0000-4000-8000-000000000040';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: ADDRESS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		label: 'Home',
		city: 'Berlin',
		countryCode: 'DE',
		ownerType: AddressOwnerType.CONTACT,
		ownerId: CONTACT,
		customerId: CONTACT,
		isDefaultShipping: true,
		isDefaultBilling: false,
		isValidated: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_ADDRESS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		label: 'Warehouse',
		city: 'Hamburg',
		countryCode: 'DE',
		ownerType: AddressOwnerType.WAREHOUSE,
		ownerId: '00000000-0000-4000-8000-000000000050',
		isDefaultShipping: false,
		isDefaultBilling: false,
		isValidated: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const addressService = {
		listAddresses: jest.fn().mockResolvedValue(ROWS),
		findAddress: jest.fn().mockResolvedValue(ROWS[0]),
		findAddressOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createAddress: jest.fn().mockResolvedValue(ROWS[0]),
		updateAddress: jest.fn().mockResolvedValue(ROWS[0]),
		softRemoveAddress: jest.fn().mockResolvedValue(ROWS[0]),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		setDefaultAddress: jest.fn().mockResolvedValue(ROWS[0]),
		clearDefaultAddress: jest.fn().mockResolvedValue(ROWS[1])
	};

	return { addressService, resolver: new AddressResolver(addressService as never) };
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
		join(__dirname, '..', 'address-role', 'schema'),
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

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof AddressController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof AddressController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = AddressResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the permission of a field is read from the
 * field and from the route's own metadata and compared, rather than restated here: a table of
 * permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'addresses', route: 'findAll' },
	{ field: 'address', route: 'findById' },
	{ field: 'createAddress', route: 'create' },
	{ field: 'updateAddress', route: 'update' },
	{ field: 'deleteAddress', route: 'delete' },
	{ field: 'softDeleteAddress', route: 'softRemove' },
	{ field: 'recoverAddress', route: 'softRecover' },
	{ field: 'setDefaultAddress', route: 'setDefault' }
];

describe('AddressResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the two address queries', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['addresses', 'address']));
	});

	it('declares every address mutation, and no more than the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createAddress',
				'updateAddress',
				'deleteAddress',
				'softDeleteAddress',
				'recoverAddress',
				'setDefaultAddress'
			])
		);
	});

	it('declares the address connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type AddressConnection \{\s*nodes: \[Address!\]!\s*edges: \[AddressEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type AddressEdge \{\s*node: Address!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input AddressFilter \{/);
		expect(printed).toMatch(/input AddressSort \{/);
		expect(printed).toMatch(/enum AddressSortField \{/);
		expect(printed).toMatch(/input AddressOwnerTypeFilter \{/);
		expect(printed).toMatch(/input SetDefaultAddressInput \{/);
		// The kernel's page info is referenced, never redeclared: the schema builds rather than fails
		// when the same name is declared twice, and the composition check is what refuses it.
		expect(printed).toMatch(/type PageInfo \{/);
	});
});

describe('AddressResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, addressService } = surfaces();

		const connection = await resolver.addresses(undefined, undefined, undefined, 20);

		expect(addressService.listAddresses).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ADDRESS);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.addresses({ ownerType: { eq: AddressOwnerType.WAREHOUSE } });

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_ADDRESS]);
		// The total is the filtered total, which is what the REST envelope reports as `total`.
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.addresses(undefined, [{ field: 'city', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.city)).toEqual(['Berlin', 'Hamburg']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.addresses(undefined, undefined, undefined, 1);

		const second = await resolver.addresses(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_ADDRESS]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.addresses(undefined, [{ field: 'isValidated', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.addresses({ passwordHash: { eq: 'x' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.addresses(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.addresses(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('AddressResolver — one concept, two protocols, the same writes', () => {
	it('reads one address, answering null rather than failing when there is none', async () => {
		const { resolver, addressService } = surfaces();

		await expect(resolver.address(ADDRESS)).resolves.toBe(ROWS[0]);
		addressService.findAddress.mockResolvedValueOnce(null);
		await expect(resolver.address(ADDRESS)).resolves.toBeNull();
	});

	it('creates, updates and removes through the same service methods the REST routes call', async () => {
		const { resolver, addressService } = surfaces();

		await resolver.createAddress({
			organizationId: ORGANIZATION,
			line1: '1 Example Street',
			city: 'Berlin',
			countryCode: 'DE',
			ownerId: CONTACT
		});
		await resolver.updateAddress({ id: ADDRESS, label: 'Office' });
		await resolver.deleteAddress(ADDRESS);

		expect(addressService.createAddress).toHaveBeenCalledWith(
			expect.objectContaining({ line1: '1 Example Street' })
		);
		expect(addressService.updateAddress).toHaveBeenCalledWith(ADDRESS, expect.objectContaining({ label: 'Office' }));
		expect(addressService.softRemoveAddress).toHaveBeenCalledWith(ADDRESS);
	});

	it('removes and recovers through the same service methods the two CRUD routes reach', async () => {
		const { resolver, addressService } = surfaces();

		await resolver.softDeleteAddress(ADDRESS);
		await expect(resolver.recoverAddress(ADDRESS)).resolves.toBe(ROWS[0]);

		// `DELETE /:id/soft` is restated by this controller and routed to the domain's own removal,
		// because the inherited one would delete an address the party still names as its default — the
		// one removal `softRemoveAddress` refuses. `PUT /:id/recover` is left inherited, so the field
		// calls the base service method that handler calls, and the domain's removal is not reached.
		expect(addressService.softRemoveAddress).toHaveBeenCalledWith(ADDRESS);
		expect(addressService.softRecover).toHaveBeenCalledWith(ADDRESS);
	});

	it('moves a default and clears one through the two methods that own them', async () => {
		const { resolver, addressService } = surfaces();

		await resolver.setDefaultAddress({ id: ADDRESS, role: AddressRoleEnum.SHIPPING });
		await resolver.setDefaultAddress({ id: ADDRESS, role: AddressRoleEnum.SHIPPING, isDefault: false });

		expect(addressService.setDefaultAddress).toHaveBeenCalledWith(ADDRESS, AddressRoleEnum.SHIPPING);
		expect(addressService.clearDefaultAddress).toHaveBeenCalledWith(ADDRESS, AddressRoleEnum.SHIPPING);
	});

	it('surfaces a contradiction between the two locations of a default as a refusal, never a miss', async () => {
		const refusal = new BadRequestException(
			'ADDRESS_DEFAULT_MISMATCH: The default address of this party is another row, and the write named this one to be cleared.'
		);
		const addressService = {
			listAddresses: jest.fn().mockResolvedValue(ROWS),
			clearDefaultAddress: jest.fn().mockRejectedValue(refusal),
			setDefaultAddress: jest.fn().mockResolvedValue(ROWS[0])
		};
		const resolver = new AddressResolver(addressService as never);

		const error = await resolver
			.setDefaultAddress({ id: ADDRESS, role: AddressRoleEnum.SHIPPING, isDefault: false })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('ADDRESS_DEFAULT_MISMATCH');
		// Clearing never reaches the set direction, which is the whole point of routing the two
		// directions to the two methods that own them.
		expect(addressService.setDefaultAddress).not.toHaveBeenCalled();
	});
});

describe('AddressResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', AddressResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('states on every field the permission its own route runs under', () => {
		// The permissions are the controller's own metadata, applied the way the guards apply it, so a
		// field that widened or narrowed a route would be caught here rather than by a second list that
		// agrees with the resolver because it was copied from it.
		for (const { field, route } of PERMISSION_PARITY) {
			expect(permissionOfField(field)).toEqual(permissionOfRoute(AddressController, route));
		}
	});

	it('states the class’s read grant on the recovery, because the route it mirrors states none', () => {
		// `PUT /:id/recover` is inherited from the CRUD base and this controller does not override it, so
		// the handler carries no permission of its own and the guard resolves the controller's class-level
		// `ORG_CONTACT_VIEW` for it. A write mutation carrying a read grant reads like a slip and is the
		// parity: the edit grant the writes beside it carry would make GraphQL narrower than the REST
		// route, and tightening the route instead would change a delivered endpoint's authorisation —
		// the platform's call rather than this surface's.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(AddressController)['softRecover'])).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AddressController)).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);
		expect(permissionOfField('recoverAddress')).toEqual([PermissionsEnum.ORG_CONTACT_VIEW]);
		expect(permissionOfRoute(AddressController, 'softRecover')).toEqual([PermissionsEnum.ORG_CONTACT_VIEW]);
	});

	it('carries the edit grant on the withdrawal the controller restates for that reason', () => {
		// The counterpart of the case above: `DELETE /:id/soft` *is* declared on this controller, with
		// `ORG_CONTACT_EDIT` on the handler, so the field mirrors the declared grant rather than the class
		// one — which is what makes the recovery's read grant a statement about its route instead of a
		// pattern copied from its neighbour.
		expect(permissionOfRoute(AddressController, 'softRemove')).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
		expect(permissionOfField('softDeleteAddress')).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
	});

	it('carries the read permission on the resource and the write permission on every write', () => {
		const proto = AddressResolver.prototype;
		// The recovery is the one write that is deliberately absent from this list, and its own case above
		// is where its read grant is asserted: restating the edit grant here would assert the opposite of
		// what its route resolves to.
		const expected: Array<[string, PermissionsEnum]> = [
			['addresses', PermissionsEnum.ORG_CONTACT_VIEW],
			['address', PermissionsEnum.ORG_CONTACT_VIEW],
			['createAddress', PermissionsEnum.ORG_CONTACT_EDIT],
			['updateAddress', PermissionsEnum.ORG_CONTACT_EDIT],
			['deleteAddress', PermissionsEnum.ORG_CONTACT_EDIT],
			['softDeleteAddress', PermissionsEnum.ORG_CONTACT_EDIT],
			['setDefaultAddress', PermissionsEnum.ORG_CONTACT_EDIT]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AddressResolver)).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads. A write field
		// that carried the read permission — or none — would be reachable by every caller that may look.
		// `recoverAddress` is deliberately not in this list: it states the read grant because the inherited
		// route it mirrors resolves to it, which the case above pins.
		const proto = AddressResolver.prototype;

		for (const field of ['createAddress', 'updateAddress', 'deleteAddress', 'softDeleteAddress', 'setDefaultAddress']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.ORG_CONTACT_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('offers no root field for the address-validation strategy the kernel does not ship', () => {
		expect(rootFields('Mutation')).not.toEqual(expect.arrayContaining(['validateAddress']));
	});

	it('offers no argument it cannot honour', () => {
		const printed = printSchema(schema);

		// Soft-deleted rows are not readable through the delivered list method, so the connection does
		// not offer the argument the specification lists among the shared connection arguments.
		expect(printed).not.toMatch(/addresses\([^)]*withDeleted/);
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
		getHandler: () => (AddressResolver.prototype as never)[field],
		getClass: () => AddressResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('AddressResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, AddressResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', AddressResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('addresses')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('addresses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('addresses'))).resolves.toBe(true);
	});
});
