/**
 * **Nothing is doubled here, and that is the point.**
 *
 * The price-list controller is the real one — the routes it declares and the two inherited ones it
 * overrides — and so is the price-list resolver, with its own decorators and its own signatures, and so
 * is `CrudController` behind them. Both are driven over one stubbed service, which is the seam the
 * parity requirement is about: the permission a route states is read from the route's own metadata and
 * compared with the field's, so a table of permission names written out in this file could not agree
 * with one surface while disagreeing with the other, which is the failure this half of the parity
 * doctrine exists to catch. The two inherited routes are the kernel's own bodies, so what a field is
 * compared against is the delegation the platform really makes rather than a restatement of it.
 *
 * This package reaches the kernel's real barrel already — its service specs do — so the reason the
 * sibling packages give for doubling `@gauzy/core` (the ESM-only `uuid` nested in the entity graph)
 * does not apply here: `transformIgnorePatterns` in this package's jest config transforms it instead.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { PriceListController } from '../../price-list/price-list.controller';
import { schemaExtensions } from '../schema-extensions';
import { PriceListResolver } from './price-list.resolver';

/**
 * The price list's capabilities over GraphQL (17 §3.1).
 *
 * The parity requirement is capability parity, and this half of it is the one that was missing: the
 * controller serves a soft delete, a recover and a dry run, and the resolver served none of the three.
 * A GraphQL caller could therefore retire a list only by hard-deleting it — cascading the prices it
 * carried — and could not restore one at all, while a REST caller could do both. Three properties are
 * pinned for each field:
 *
 * - it is **declared** in the pricing document, with the arguments and the return type the route's own
 *   signature implies, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only `PRICE_LISTS_VIEW` is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same scope, because two
 *   protocols that do the same thing differently are two behaviours waiting to diverge.
 */

const LIST = '00000000-0000-4000-8000-000000000120';
const VARIANT = '00000000-0000-4000-8000-000000000010';

/** The context the dry run is asked for, as the route's body DTO states it. */
const CONTEXT = {
	variantIds: [VARIANT],
	currency: 'CAD',
	quantity: '2',
	date: new Date('2026-01-15T12:00:00.000Z'),
	channelId: '00000000-0000-4000-8000-0000000000c1',
	regionId: '00000000-0000-4000-8000-0000000000c2',
	customerId: '00000000-0000-4000-8000-0000000000c3',
	customerGroupIds: ['00000000-0000-4000-8000-0000000000c4']
};

/**
 * One price list, as the service answers it, so the two surfaces can be compared by identity.
 */
const SOFT_DELETED = { id: LIST, name: 'Summer sale', code: 'SUMMER', deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: LIST, name: 'Summer sale', code: 'SUMMER', deletedAt: null };
const RESOLUTIONS = [{ variantId: VARIANT, currency: 'CAD', amount: '14.990000', source: 'PRICE_LIST' }];

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: both protocols must reach the same method
 * with the same arguments, and a stub is what makes that visible without a database behind it.
 *
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces() {
	const service = {
		softRemove: jest.fn().mockResolvedValue(SOFT_DELETED),
		softRecover: jest.fn().mockResolvedValue(RESTORED),
		simulate: jest.fn().mockResolvedValue(RESOLUTIONS),
		deletePriceList: jest.fn().mockResolvedValue({ affected: 1 }),
		expire: jest.fn().mockResolvedValue(RESTORED)
	};

	return {
		service,
		controller: new PriceListController(service as never),
		resolver: new PriceListResolver(service as never)
	};
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PriceListController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof PriceListResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to a
 * second copy of the same list written in this file.
 *
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PriceListController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PriceListController)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PriceListResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PriceListResolver)
	);
}

/** The guards one surface actually runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: typeof PriceListController | typeof PriceListResolver, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? (Reflect.getMetadata('__guards__', (surface.prototype as any)[handler]) ?? []) : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own field declarations, as the document spells them. */
function mutationField(name: string): FieldDefinitionNode {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	const field = mutation?.fields?.find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the pricing document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The name of the type a field answers with, however deeply it is wrapped. */
function namedTypeOf(field: FieldDefinitionNode): string {
	return namedTypeName(field.type);
}

/**
 * Every new root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the field's permission is compared with the
 * route's own metadata rather than with a literal written here.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'softDeletePriceList', route: 'softRemove' },
	{ field: 'recoverPriceList', route: 'softRecover' },
	{ field: 'simulatePriceList', route: 'simulate' }
];

describe('PriceListResolver — the SDL declares the write routes the controller serves', () => {
	it.each(ROUTE_PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier every one of the three routes takes, and the context the dry run states', () => {
		expect((mutationField('softDeletePriceList').arguments ?? []).map((argument) => argument.name.value)).toEqual([
			'id'
		]);
		expect((mutationField('recoverPriceList').arguments ?? []).map((argument) => argument.name.value)).toEqual([
			'id'
		]);
		expect((mutationField('simulatePriceList').arguments ?? []).map((argument) => argument.name.value)).toEqual([
			'id',
			'input'
		]);

		// The dry run's context is the input the resolution query already takes, because it is the same
		// question: `SimulatePriceListDTO` and `ResolvePriceInput` are one shape, member for member.
		const input = (mutationField('simulatePriceList').arguments ?? []).find(
			(argument) => argument.name.value === 'input'
		);

		expect(input && namedTypeName(input.type)).toBe('ResolvePriceInput');
	});

	it('answers what each route answers', () => {
		// The two lifecycle routes answer the row, which is what `CrudController` returns; the dry run
		// answers one resolution per variant the list prices, as the route does.
		expect(namedTypeOf(mutationField('softDeletePriceList'))).toBe('PriceList');
		expect(namedTypeOf(mutationField('recoverPriceList'))).toBe('PriceList');
		expect(namedTypeOf(mutationField('simulatePriceList'))).toBe('ResolvedPrice');
	});

	it('keeps the mutations it already served', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const field of [
			'createPriceList',
			'updatePriceList',
			'deletePriceList',
			'activatePriceList',
			'expirePriceList'
		]) {
			expect(mutationField(field).name.value).toBe(field);
		}
	});
});

describe('PriceListResolver — one capability, two protocols, the same delegations', () => {
	it('retires a list through the same service method the soft-delete route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRemove(LIST);
		const overGraphql = await resolver.softDeletePriceList(LIST);

		// The inherited route hands over its rest parameter, which is an empty ARRAY; `toFindOneOptions`
		// normalises both that and an absent argument to "no find options", so the two are one call.
		expect(service.softRemove).toHaveBeenNthCalledWith(1, LIST, []);
		expect(service.softRemove).toHaveBeenNthCalledWith(2, LIST);
		expect(service.softRemove).toHaveBeenCalledTimes(2);

		// One answer, one implementation: a list retired over either protocol is the same row.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(SOFT_DELETED);
	});

	it('restores a list through the same service method the recover route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRecover(LIST);
		const overGraphql = await resolver.recoverPriceList(LIST);

		expect(service.softRecover).toHaveBeenNthCalledWith(1, LIST, []);
		expect(service.softRecover).toHaveBeenNthCalledWith(2, LIST);
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(RESTORED);
	});

	it('dry-runs a list through the same service method, with the context the route passes', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.simulate(LIST, CONTEXT as never);
		const overGraphql = await resolver.simulatePriceList(LIST, CONTEXT as never);

		// The route hands its body over unchanged and so does the field, member for member.
		expect(service.simulate).toHaveBeenNthCalledWith(1, LIST, CONTEXT);
		expect(service.simulate).toHaveBeenNthCalledWith(2, LIST, CONTEXT);
		expect(overGraphql).toBe(overRest);
		expect(overGraphql).toBe(RESOLUTIONS);
	});

	it('writes nothing when it simulates, because the route writes nothing either', async () => {
		const { service, resolver } = surfaces();

		await resolver.simulatePriceList(LIST, CONTEXT as never);

		// The dry run is the one capability of the three that must not move a row: no delete, no status
		// change, no counter. Asserted on the service's other writes rather than on the simulated one,
		// so a resolver that "helpfully" retired the list while previewing it fails here.
		expect(service.deletePriceList).not.toHaveBeenCalled();
		expect(service.expire).not.toHaveBeenCalled();
		expect(service.softRemove).not.toHaveBeenCalled();
	});
});

describe('PriceListResolver — the authorisation is the route’s, field by field', () => {
	it('states on every new field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(ROUTE_PARITY.some(({ route }) => permissionOfRoute(route))).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			// The handler is asserted to be there before the two readings are compared — inherited
			// handlers included, which is why the inherited ones are overridden on this controller at
			// all: the base declares its routes with no permission metadata of its own.
			expect(typeof handlersOf(PriceListController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PriceListResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PriceListController)[route])
			);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(route));
		}
	});

	it('demands the destructive grant for the two lifecycle moves and the simulation grant for the dry run', () => {
		// Stated explicitly as well as by comparison, because these three are the ones a reader will
		// want to see: the class-level grant is only `PRICE_LISTS_VIEW`, and a field that left the
		// destructive or the simulation grant to the class would extend the view permission into a
		// write — which is the defect this whole wave exists to close.
		expect(permissionOfField('softDeletePriceList')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE)
		]);
		expect(permissionOfField('recoverPriceList')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE)
		]);
		expect(permissionOfField('simulatePriceList')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_SIMULATE)
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PriceListResolver)).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_VIEW)
		]);
	});

	it('runs the fields under the controller’s guard chain, plus the gate the endpoint adds', () => {
		const controllerGuards = guardsOf(PriceListController);
		const resolverGuards = guardsOf(PriceListResolver);

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining(controllerGuards));

		for (const { field } of ROUTE_PARITY) {
			expect(guardsOf(PriceListResolver, field)).toEqual(expect.arrayContaining(controllerGuards));
		}
	});
});

/**
 * The one field of this resource that mirrors no route.
 *
 * `PriceListService.expire` moves a list to `INACTIVE` and no route of the controller serves it: the
 * controller carries `activate`, and a withdrawal is reachable over REST only by stating `status` on
 * the update route. The field is therefore a divergence from "one mutation per route" — an extra root
 * field is as much a divergence as a missing one — and it is **recorded here rather than removed**:
 * removing a root field is a breaking change to the schema and the owner's call, not this suite's.
 */
describe('PriceListResolver — the withdrawal that mirrors no route', () => {
	it('is served by GraphQL and by no handler of the controller', async () => {
		expect(typeof fieldsOf(PriceListResolver)['expirePriceList']).toBe('function');
		expect(typeof handlersOf(PriceListController)['expire']).toBe('undefined');

		// It is not the update route under another name either: it calls a method of its own, which is
		// what makes it a capability rather than a spelling of one.
		const { service, resolver } = surfaces();

		await resolver.expirePriceList(LIST);

		expect(service.expire).toHaveBeenCalledWith(LIST);
	});
});
