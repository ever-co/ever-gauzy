/**
 * **Nothing is doubled here, and that is the point.**
 *
 * The exchange-rate controller is the real one — the routes it declares and the two inherited ones it
 * overrides — and so is the exchange-rate resolver, with its own decorators and its own signatures, and
 * so is `CrudController` behind them. Both are driven over one stubbed service, which is the seam the
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
import { ExchangeRateController } from '../../exchange-rate/exchange-rate.controller';
import { schemaExtensions } from '../schema-extensions';
import { ExchangeRateResolver } from './exchange-rate.resolver';

/**
 * The exchange rate's capabilities over GraphQL (17 §3.1).
 *
 * The parity requirement is capability parity, and this half of it was missing: the controller serves
 * a soft delete and a recover — both overridden to state a permission the inherited route did not
 * carry — and the resolver served neither. A GraphQL caller could therefore retire a rate only by
 * hard-deleting it, destroying the row a historical order's conversion was computed from, and could
 * not bring one back at all, while a REST caller could do both. Three properties are pinned for each
 * field:
 *
 * - it is **declared** in the pricing document, with the arguments and the return type the route's own
 *   signature implies, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only `EXCHANGE_RATES_VIEW` is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same scope, because two
 *   protocols that do the same thing differently are two behaviours waiting to diverge.
 */

const RATE = '00000000-0000-4000-8000-000000000130';

/**
 * One rate, as the service answers it, so the two surfaces can be compared by identity.
 */
const SOFT_DELETED = {
	id: RATE,
	fromCurrency: 'USD',
	toCurrency: 'CAD',
	rate: '1.350000',
	deletedAt: new Date('2026-02-01T00:00:00.000Z')
};
const RESTORED = { id: RATE, fromCurrency: 'USD', toCurrency: 'CAD', rate: '1.350000', deletedAt: null };

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: both protocols must reach the same method
 * with the same arguments, and a stub is what makes that visible without a database behind it. The two
 * removal methods the delete route reaches are stubbed as well, so a resolver that took the hard path
 * instead of the recoverable one fails here rather than in production.
 *
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces() {
	const service = {
		softRemove: jest.fn().mockResolvedValue(SOFT_DELETED),
		softRecover: jest.fn().mockResolvedValue(RESTORED),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softDelete: jest.fn().mockResolvedValue(SOFT_DELETED),
		findOneByIdString: jest.fn().mockResolvedValue(SOFT_DELETED)
	};

	return {
		service,
		controller: new ExchangeRateController(service as never),
		resolver: new ExchangeRateResolver(service as never)
	};
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ExchangeRateController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof ExchangeRateResolver): Record<string, object> {
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ExchangeRateController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ExchangeRateController)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ExchangeRateResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ExchangeRateResolver)
	);
}

/** The guards one surface actually runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: typeof ExchangeRateController | typeof ExchangeRateResolver, handler?: string): unknown[] {
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
	{ field: 'softDeleteExchangeRate', route: 'softRemove' },
	{ field: 'recoverExchangeRate', route: 'softRecover' }
];

describe('ExchangeRateResolver — the SDL declares the write routes the controller serves', () => {
	it.each(ROUTE_PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier both routes take, and nothing else', () => {
		// `id: ID!` and not the update field's whole input: a lifecycle move names the row and states
		// nothing about it, so an input object here would invite a caller to send edits that this
		// capability does not make.
		for (const { field } of ROUTE_PARITY) {
			const argument = (mutationField(field).arguments ?? []).find((candidate) => candidate.name.value === 'id');

			expect((mutationField(field).arguments ?? []).map((candidate) => candidate.name.value)).toEqual(['id']);
			expect(argument && namedTypeName(argument.type)).toBe('ID');
			expect(argument && argument.type.kind).toBe('NonNullType');
		}
	});

	it('answers the rate, which is what the routes answer', () => {
		// `CrudController.softRemove` and `softRecover` both answer the row, so a caller can read the
		// stored state back — including the `deletedAt` the move just stamped — without a second query
		// that could observe a different one.
		expect(namedTypeOf(mutationField('softDeleteExchangeRate'))).toBe('ExchangeRate');
		expect(namedTypeOf(mutationField('recoverExchangeRate'))).toBe('ExchangeRate');
	});

	it('keeps the mutations it already served', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const field of ['createExchangeRate', 'updateExchangeRate', 'deleteExchangeRate']) {
			expect(mutationField(field).name.value).toBe(field);
		}
	});
});

describe('ExchangeRateResolver — one capability, two protocols, the same delegations', () => {
	it('retires a rate through the same service method the soft-delete route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRemove(RATE);
		const overGraphql = await resolver.softDeleteExchangeRate(RATE);

		// The inherited route hands over its rest parameter, which is an empty ARRAY; `toFindOneOptions`
		// normalises both that and an absent argument to "no find options", so the two are one call.
		expect(service.softRemove).toHaveBeenNthCalledWith(1, RATE, []);
		expect(service.softRemove).toHaveBeenNthCalledWith(2, RATE);
		expect(service.softRemove).toHaveBeenCalledTimes(2);

		// One answer, one implementation: a rate retired over either protocol is the same row.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(SOFT_DELETED);
	});

	it('restores a rate through the same service method the recover route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRecover(RATE);
		const overGraphql = await resolver.recoverExchangeRate(RATE);

		expect(service.softRecover).toHaveBeenNthCalledWith(1, RATE, []);
		expect(service.softRecover).toHaveBeenNthCalledWith(2, RATE);
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(RESTORED);
	});

	it('retires recoverably rather than through the delete route’s removal', async () => {
		const { service, resolver } = surfaces();

		await resolver.softDeleteExchangeRate(RATE);

		// This is the whole point of the field: the capability the resolver already served removes the
		// row outright when it is asked to, and a caller left with only that has no recoverable
		// removal and therefore nothing to restore.
		expect(service.delete).not.toHaveBeenCalled();
		expect(service.softDelete).not.toHaveBeenCalled();
		expect(service.softRemove).toHaveBeenCalledWith(RATE);
	});
});

describe('ExchangeRateResolver — the authorisation is the route’s, field by field', () => {
	it('states on every new field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(ROUTE_PARITY.some(({ route }) => permissionOfRoute(route))).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			// The handler is asserted to be there before the two readings are compared — inherited
			// handlers included, which is why the inherited ones are overridden on this controller at
			// all: the base declares its routes with no permission metadata of its own.
			expect(typeof handlersOf(ExchangeRateController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ExchangeRateResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ExchangeRateController)[route])
			);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(route));
		}
	});

	it('demands the administrative edit grant for both lifecycle moves', () => {
		// Stated explicitly as well as by comparison, because this pair is one a reader will want to
		// see: the class-level grant is only `EXCHANGE_RATES_VIEW`, and a field that left the edit
		// grant to the class would extend the read permission into a write — which is the defect this
		// whole wave exists to close. `EXCHANGE_RATES_EDIT` is the administrative one, because a rate
		// is the conversion applied to every foreign-currency amount in the tenant.
		expect(permissionOfField('softDeleteExchangeRate')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT)
		]);
		expect(permissionOfField('recoverExchangeRate')).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT)
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExchangeRateResolver)).toEqual([
			pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_VIEW)
		]);
	});

	it('runs the fields under the controller’s guard chain, plus the gate the endpoint adds', () => {
		const controllerGuards = guardsOf(ExchangeRateController);
		const resolverGuards = guardsOf(ExchangeRateResolver);

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining(controllerGuards));

		for (const { field } of ROUTE_PARITY) {
			expect(guardsOf(ExchangeRateResolver, field)).toEqual(expect.arrayContaining(controllerGuards));
		}
	});
});
