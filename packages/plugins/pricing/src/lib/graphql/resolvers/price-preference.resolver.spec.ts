/**
 * **Nothing is doubled here, and that is the point.**
 *
 * The price-preference controller is the real one — the routes it declares and the two inherited ones
 * it overrides — and so is the price-preference resolver, with its own decorators and its own
 * signatures, and so is `CrudController` behind them. Both are driven over one stubbed service, which is
 * the seam the parity requirement is about: the permission a route states is read from the route's own
 * metadata and compared with the field's, so a table of permission names written out in this file could
 * not agree with one surface while disagreeing with the other, which is the failure this half of the
 * parity doctrine exists to catch. The two inherited routes are the kernel's own bodies, so what a field
 * is compared against is the delegation the platform really makes rather than a restatement of it.
 *
 * This package reaches the kernel's real barrel already — its service specs do — so the reason the
 * sibling packages give for doubling `@gauzy/core` (the ESM-only `uuid` nested in the entity graph)
 * does not apply here: `transformIgnorePatterns` in this package's jest config transforms it instead.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { PricePreferenceController } from '../../price-preference/price-preference.controller';
import { schemaExtensions } from '../schema-extensions';
import { PricePreferenceResolver } from './price-preference.resolver';

/**
 * The tax-inclusivity preference's capabilities over GraphQL (17 §3.1).
 *
 * The parity requirement is capability parity, and this resource is the one where the gap was widest:
 * the controller serves a soft delete and a recover — both overridden to state a permission the
 * inherited route did not carry — and the resolver served **no delete at all**. A preference retired
 * over REST was therefore frozen for a GraphQL client, which could neither retire nor restore it, and
 * the two surfaces of one lifecycle disagreed about which of them could complete it. Three properties
 * are pinned for each field:
 *
 * - it is **declared** in the pricing document, with the arguments and the return type the route's own
 *   signature implies, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only `PRODUCT_PRICES_VIEW` is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same scope, because two
 *   protocols that do the same thing differently are two behaviours waiting to diverge.
 */

const PREFERENCE = '00000000-0000-4000-8000-000000000140';

/**
 * One preference, as the service answers it, so the two surfaces can be compared by identity.
 */
const SOFT_DELETED = {
	id: PREFERENCE,
	attribute: 'CURRENCY',
	value: 'CAD',
	isTaxInclusive: true,
	deletedAt: new Date('2026-02-01T00:00:00.000Z')
};
const RESTORED = { id: PREFERENCE, attribute: 'CURRENCY', value: 'CAD', isTaxInclusive: true, deletedAt: null };

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: both protocols must reach the same method
 * with the same arguments, and a stub is what makes that visible without a database behind it. The
 * update path is stubbed as well, so a lifecycle field that quietly answered by writing
 * `isTaxInclusive` — the only write this resolver served before — fails here rather than in production.
 *
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces() {
	const service = {
		softRemove: jest.fn().mockResolvedValue(SOFT_DELETED),
		softRecover: jest.fn().mockResolvedValue(RESTORED),
		updateOne: jest.fn().mockResolvedValue({ affected: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(RESTORED)
	};

	return {
		service,
		controller: new PricePreferenceController(service as never),
		resolver: new PricePreferenceResolver(service as never)
	};
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PricePreferenceController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof PricePreferenceResolver): Record<string, object> {
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PricePreferenceController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PricePreferenceController)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PricePreferenceResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PricePreferenceResolver)
	);
}

/** The guards one surface actually runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: typeof PricePreferenceController | typeof PricePreferenceResolver, handler?: string): unknown[] {
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
	{ field: 'softDeletePricePreference', route: 'softRemove' },
	{ field: 'recoverPricePreference', route: 'softRecover' }
];

describe('PricePreferenceResolver — the SDL declares the write routes the controller serves', () => {
	it.each(ROUTE_PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier both routes take, and nothing else', () => {
		// `id: ID!` and not the update field's whole input: a lifecycle move names the row and states
		// nothing about it, so an input object here would invite a caller to send an answer this
		// capability does not write — and `isTaxInclusive` is deliberately not nullable on the update
		// input, so a shape shared with it could not even be sent without one.
		for (const { field } of ROUTE_PARITY) {
			const argument = (mutationField(field).arguments ?? []).find((candidate) => candidate.name.value === 'id');

			expect((mutationField(field).arguments ?? []).map((candidate) => candidate.name.value)).toEqual(['id']);
			expect(argument && namedTypeName(argument.type)).toBe('ID');
			expect(argument && argument.type.kind).toBe('NonNullType');
		}
	});

	it('answers the preference, which is what the routes answer', () => {
		// `CrudController.softRemove` and `softRecover` both answer the row, so a caller can read the
		// stored state back — including the `deletedAt` the move just stamped — without a second query
		// that could observe a different one.
		expect(namedTypeOf(mutationField('softDeletePricePreference'))).toBe('PricePreference');
		expect(namedTypeOf(mutationField('recoverPricePreference'))).toBe('PricePreference');
	});

	it('keeps the mutation it already served', () => {
		// A parity change is additive: the field that was there stays there.
		expect(mutationField('updatePricePreference').name.value).toBe('updatePricePreference');
	});
});

describe('PricePreferenceResolver — one capability, two protocols, the same delegations', () => {
	it('retires a preference through the same service method the soft-delete route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRemove(PREFERENCE);
		const overGraphql = await resolver.softDeletePricePreference(PREFERENCE);

		// The inherited route hands over its rest parameter, which is an empty ARRAY; `toFindOneOptions`
		// normalises both that and an absent argument to "no find options", so the two are one call.
		expect(service.softRemove).toHaveBeenNthCalledWith(1, PREFERENCE, []);
		expect(service.softRemove).toHaveBeenNthCalledWith(2, PREFERENCE);
		expect(service.softRemove).toHaveBeenCalledTimes(2);

		// One answer, one implementation: a preference retired over either protocol is the same row.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(SOFT_DELETED);
	});

	it('restores a preference through the same service method the recover route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRecover(PREFERENCE);
		const overGraphql = await resolver.recoverPricePreference(PREFERENCE);

		expect(service.softRecover).toHaveBeenNthCalledWith(1, PREFERENCE, []);
		expect(service.softRecover).toHaveBeenNthCalledWith(2, PREFERENCE);
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(RESTORED);
	});

	it('does not answer a lifecycle move by writing the answer the update field writes', async () => {
		const { service, resolver } = surfaces();

		await resolver.softDeletePricePreference(PREFERENCE);
		await resolver.recoverPricePreference(PREFERENCE);

		// The failure this pins: "retiring" a preference by flipping `isTaxInclusive` would leave the
		// row live and answering, so a scope that was meant to fall back would keep pricing and nothing
		// would be recoverable, because nothing was ever removed.
		expect(service.updateOne).not.toHaveBeenCalled();
		expect(service.softRemove).toHaveBeenCalledWith(PREFERENCE);
		expect(service.softRecover).toHaveBeenCalledWith(PREFERENCE);
	});
});

describe('PricePreferenceResolver — the authorisation is the route’s, field by field', () => {
	it('states on every new field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(ROUTE_PARITY.some(({ route }) => permissionOfRoute(route))).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			// The handler is asserted to be there before the two readings are compared — inherited
			// handlers included, which is why the inherited ones are overridden on this controller at
			// all: the base declares its routes with no permission metadata of its own.
			expect(typeof handlersOf(PricePreferenceController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PricePreferenceResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PricePreferenceController)[route])
			);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(route));
		}
	});

	it('demands the edit grant for both lifecycle moves', () => {
		// Stated explicitly as well as by comparison, because this pair is one a reader will want to
		// see: the class-level grant is only `PRODUCT_PRICES_VIEW`, and a field that left the edit
		// grant to the class would extend the read permission into a write — which is the defect this
		// whole wave exists to close. This resource is governed by the product-price pair rather than
		// by one of its own, because a preference is configuration: retiring one changes what a
		// tax-inclusive price resolves to for a whole currency, region or channel.
		expect(permissionOfField('softDeletePricePreference')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT)
		]);
		expect(permissionOfField('recoverPricePreference')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT)
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PricePreferenceResolver)).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW)
		]);
	});

	it('runs the fields under the controller’s guard chain, plus the gate the endpoint adds', () => {
		const controllerGuards = guardsOf(PricePreferenceController);
		const resolverGuards = guardsOf(PricePreferenceResolver);

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining(controllerGuards));

		for (const { field } of ROUTE_PARITY) {
			expect(guardsOf(PricePreferenceResolver, field)).toEqual(expect.arrayContaining(controllerGuards));
		}
	});
});
