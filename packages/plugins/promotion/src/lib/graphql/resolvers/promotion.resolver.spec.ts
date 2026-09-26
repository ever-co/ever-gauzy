/**
 * **Nothing is doubled here, and that is the point.**
 *
 * The promotion controller is the real one — the routes it declares and the two inherited ones it
 * overrides — and so is the promotion resolver, with its own decorators and its own signatures, and so
 * is `CrudController` behind them. Both are driven over one stubbed service, which is the seam the
 * parity requirement is about: the permission a route states is read from the route's own metadata and
 * compared with the field's, so a table of permission names written out in this file could not agree
 * with one surface while disagreeing with the other, which is the failure this half of the parity
 * doctrine exists to catch. The two inherited routes are the kernel's own bodies, so what a field is
 * compared against is the delegation the platform really makes rather than a restatement of it.
 *
 * This package reaches the kernel's real barrel already — the `with-deleted` spec beside this one
 * imports three of these resolvers — so the reason the sibling packages give for doubling `@gauzy/core`
 * does not apply here: `transformIgnorePatterns` in this package's jest config transforms the ESM-only
 * dependencies the entity graph pulls in.
 */

import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { PromotionNotice } from '../../promotion.types';
import { PromotionController } from '../../promotion/promotion.controller';
import { schemaExtensions } from '../schema-extensions';
import { PromotionResolver } from './promotion.resolver';

/**
 * The promotion's capabilities over GraphQL (17 §3.1).
 *
 * The controller serves five writes the resolver did not: a deactivation, an action-set replacement, a
 * dry run, and the two lifecycle moves inherited from `CrudController` — a soft delete and a recover.
 * Until they existed, a GraphQL caller could start an offer but not stop one, could not replace its
 * actions without an update, could not ask what it would cost without writing it, could not retire it
 * recoverably, and could not bring a retired offer back at all.
 *
 * Three properties are pinned for each field:
 *
 * - it is **declared** in the promotion document, with the arguments and the return type the route's own
 *   signature implies, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only `PROMOTIONS_VIEW` is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same arguments, because two
 *   protocols that do the same thing differently are two behaviours waiting to diverge.
 *
 * **`expirePromotion` is deliberately not one of them.** It moves a promotion to `EXPIRED` and the
 * controller serves no such route; `deactivate` moves it to `INACTIVE` and is a different act on a
 * different state. The divergence is recorded at the foot of this file rather than removed: removing a
 * root field is a breaking schema change and the owner's call, not this suite's.
 */

const PROMOTION = '00000000-0000-4000-8000-0000000000f1';

/** The basket the dry run is asked about, as the route's body states it. */
const CONTEXT = {
	currency: 'USD',
	channelId: '00000000-0000-4000-8000-0000000000c1',
	customerId: '00000000-0000-4000-8000-0000000000c2',
	customerGroupIds: ['00000000-0000-4000-8000-0000000000c3'],
	codes: ['SAVE10'],
	lines: [{ id: 'line-1', amount: '49.980000', quantity: 2, variantId: '00000000-0000-4000-8000-000000000030' }],
	shipping: [{ id: 'ship-1', amount: '9.990000' }],
	at: new Date('2026-01-15T12:00:00.000Z')
};

/** The action set a replacement stores, in application order. */
const ACTIONS = [
	{
		id: 'action-1',
		promotionId: PROMOTION,
		type: 'PERCENTAGE',
		targetType: 'ORDER',
		allocation: 'ACROSS',
		value: '10',
		isTaxInclusive: false,
		position: 0
	}
];

/** What one evaluation decided, as the service answers it. */
const EVALUATION = {
	result: {
		applications: [
			{ promotionId: PROMOTION, code: 'SAVE10', isAutomatic: false, amount: '-4.998000', currency: 'USD' }
		],
		notices: [
			{
				promotionId: PROMOTION,
				code: 'SAVE10',
				notice: PromotionNotice.PARTIALLY_APPLIED_BUDGET,
				message: 'The campaign budget admitted only part of the computed discount.',
				details: { computed: '-9.996000', headroom: '-4.998000' }
			}
		],
		discountTotal: '-4.998000',
		currency: 'USD'
	},
	allocations: [
		{
			ownerType: 'LINE' as const,
			ownerId: 'line-1',
			promotionId: PROMOTION,
			actionId: 'action-1',
			code: 'SAVE10',
			amount: '-4.998000'
		}
	]
};

/** The states the lifecycle moves leave behind. */
const DEACTIVATED = { id: PROMOTION, title: 'Ten off', status: 'INACTIVE' };
const SOFT_DELETED = {
	id: PROMOTION,
	title: 'Ten off',
	status: 'ACTIVE',
	deletedAt: new Date('2026-02-01T00:00:00.000Z')
};
const RESTORED = { id: PROMOTION, title: 'Ten off', status: 'ACTIVE', deletedAt: null };

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
		deactivate: jest.fn().mockResolvedValue(DEACTIVATED),
		replaceActions: jest.fn().mockResolvedValue(ACTIONS),
		simulate: jest.fn().mockResolvedValue(EVALUATION),
		softRemove: jest.fn().mockResolvedValue(SOFT_DELETED),
		softRecover: jest.fn().mockResolvedValue(RESTORED),
		activate: jest.fn().mockResolvedValue({ ...DEACTIVATED, status: 'ACTIVE' }),
		expire: jest.fn().mockResolvedValue({ ...DEACTIVATED, status: 'EXPIRED' }),
		delete: jest.fn().mockResolvedValue({ affected: 1 })
	};

	return {
		service,
		controller: new PromotionController(service as never),
		resolver: new PromotionResolver(
			service as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		)
	};
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PromotionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof PromotionResolver): Record<string, object> {
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
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PromotionController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PromotionController)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PromotionResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, PromotionResolver)
	);
}

/** The guards one surface actually runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: typeof PromotionController | typeof PromotionResolver, handler?: string): unknown[] {
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
		throw new Error(`the promotion document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One named type declaration of the document — an object type or an input — as the document spells it. */
function typeDefinition(name: string): ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode {
	const definition = schemaExtensions.definitions.find(
		(candidate): candidate is ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode =>
			(candidate.kind === 'ObjectTypeDefinition' || candidate.kind === 'InputObjectTypeDefinition') &&
			candidate.name.value === name
	);

	if (!definition) {
		throw new Error(`the promotion document declares no type named "${name}"`);
	}

	return definition;
}

/** The members of one object type, as a client reads them. */
function membersOf(name: string): string[] {
	return (typeDefinition(name).fields ?? []).map((field) => field.name.value);
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
	{ field: 'deactivatePromotion', route: 'deactivate' },
	{ field: 'replacePromotionActions', route: 'replaceActions' },
	{ field: 'simulatePromotion', route: 'simulate' },
	{ field: 'softDeletePromotion', route: 'softRemove' },
	{ field: 'recoverPromotion', route: 'softRecover' }
];

describe('PromotionResolver — the SDL declares the write routes the controller serves', () => {
	it.each(ROUTE_PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier every route takes, and the body each route states', () => {
		const argumentsOf = (field: string): string[] =>
			(mutationField(field).arguments ?? []).map((argument) => argument.name.value);

		expect(argumentsOf('softDeletePromotion')).toEqual(['id']);
		expect(argumentsOf('recoverPromotion')).toEqual(['id']);
		// The deactivation states a reason and the other four state only what they need: the action set,
		// the basket, the identifier.
		expect(argumentsOf('deactivatePromotion')).toEqual(['id', 'input']);
		expect(argumentsOf('replacePromotionActions')).toEqual(['id', 'input']);
		expect(argumentsOf('simulatePromotion')).toEqual(['id', 'input']);
	});

	it('answers each mutation with the payload that carries what the route returns', () => {
		expect(namedTypeOf(mutationField('deactivatePromotion'))).toBe('DeactivatePromotionPayload');
		expect(namedTypeOf(mutationField('replacePromotionActions'))).toBe('ReplacePromotionActionsPayload');
		expect(namedTypeOf(mutationField('simulatePromotion'))).toBe('SimulatePromotionPayload');
		expect(namedTypeOf(mutationField('softDeletePromotion'))).toBe('SoftDeletePromotionPayload');
		expect(namedTypeOf(mutationField('recoverPromotion'))).toBe('RecoverPromotionPayload');

		// The deactivation states no reason of its own, which is why its input is nullable; the other two
		// inputs state what the operation cannot be made without, so they are not.
		const inputOf = (field: string) =>
			(mutationField(field).arguments ?? []).find((argument) => argument.name.value === 'input');

		expect(inputOf('deactivatePromotion')?.type.kind).toBe('NamedType');
		expect(inputOf('replacePromotionActions')?.type.kind).toBe('NonNullType');
		expect(inputOf('simulatePromotion')?.type.kind).toBe('NonNullType');
	});

	it('declares the inputs and the payloads the five fields name', () => {
		expect(membersOf('DeactivatePromotionInput')).toEqual(['reason']);
		expect(membersOf('ReplacePromotionActionsInput')).toEqual(['actions']);
		expect(membersOf('PromotionSimulationInput')).toEqual([
			'currency',
			'channelId',
			'customerId',
			'customerGroupIds',
			'codes',
			'lines',
			'shipping',
			'at'
		]);
		expect(membersOf('PromotionEvaluationLineInput')).toEqual(['id', 'amount', 'quantity', 'variantId', 'sku']);
		expect(membersOf('PromotionEvaluationShippingInput')).toEqual(['id', 'amount']);

		expect(membersOf('DeactivatePromotionPayload')).toEqual(['promotion', 'operation', 'userErrors']);
		expect(membersOf('ReplacePromotionActionsPayload')).toEqual(['actions', 'operation', 'userErrors']);
		expect(membersOf('SimulatePromotionPayload')).toEqual(['result', 'allocations', 'operation', 'userErrors']);
		expect(membersOf('SoftDeletePromotionPayload')).toEqual(['promotion', 'operation', 'userErrors']);
		expect(membersOf('RecoverPromotionPayload')).toEqual(['promotion', 'operation', 'userErrors']);
	});

	it('declares the evaluation the dry run answers with, member for member', () => {
		// The dry run is the one field of the five that answers with something other than a promotion, so
		// the shapes it carries are declared here too — an undeclared member is an answer the protocol
		// cannot deliver.
		expect(membersOf('PromotionEvaluationResult')).toEqual([
			'applications',
			'notices',
			'discountTotal',
			'currency'
		]);
		expect(membersOf('PromotionApplication')).toEqual([
			'promotionId',
			'couponId',
			'code',
			'isAutomatic',
			'amount',
			'currency'
		]);
		expect(membersOf('PromotionNotice')).toEqual(['promotionId', 'code', 'notice', 'message', 'details']);
		expect(membersOf('PromotionAllocation')).toEqual([
			'ownerType',
			'ownerId',
			'promotionId',
			'actionId',
			'code',
			'amount'
		]);

		// The allocation's owner and the notice's code are the domain's own closed sets.
		expect(namedTypeName((typeDefinition('PromotionNotice').fields ?? [])[2].type)).toBe('PromotionNoticeCode');
		expect(namedTypeName((typeDefinition('PromotionAllocation').fields ?? [])[0].type)).toBe(
			'PromotionAllocationOwner'
		);
	});

	it('carries every notice the domain can raise, because a notice the enum lacks cannot be serialised', () => {
		// The service reports an exclusion with a notice from its own enumeration, and the protocol has to
		// be able to deliver every one of them: an enum that lagged the domain would turn "this coupon is
		// exhausted" into a GraphQL serialisation error at exactly the moment an operator asked why.
		const declared = (
			schemaExtensions.definitions.find(
				(definition) =>
					definition.kind === 'EnumTypeDefinition' && definition.name.value === 'PromotionNoticeCode'
			) as { values?: ReadonlyArray<{ name: { value: string } }> } | undefined
		)?.values?.map((value) => value.name.value);

		expect(declared).toEqual(expect.arrayContaining(Object.values(PromotionNotice)));
		expect(declared).toHaveLength(Object.values(PromotionNotice).length);

		const owners = (
			schemaExtensions.definitions.find(
				(definition) =>
					definition.kind === 'EnumTypeDefinition' && definition.name.value === 'PromotionAllocationOwner'
			) as { values?: ReadonlyArray<{ name: { value: string } }> } | undefined
		)?.values?.map((value) => value.name.value);

		expect(owners).toEqual(['LINE', 'SHIPPING']);
	});

	it('keeps the mutations it already served, the withdrawal included', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const field of [
			'createPromotion',
			'updatePromotion',
			'deletePromotion',
			'activatePromotion',
			'expirePromotion'
		]) {
			expect(mutationField(field).name.value).toBe(field);
		}
	});
});

describe('PromotionResolver — one capability, two protocols, the same delegations', () => {
	it('stops a promotion through the same service method the deactivation route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.deactivate(PROMOTION, { reason: 'pulled by the supplier' });
		const overGraphql = await resolver.deactivatePromotion(PROMOTION, {
			reason: 'pulled by the supplier'
		});

		expect(service.deactivate).toHaveBeenNthCalledWith(1, PROMOTION, 'pulled by the supplier');
		expect(service.deactivate).toHaveBeenNthCalledWith(2, PROMOTION, 'pulled by the supplier');

		// The reason is carried to the caller and not to the service, on both surfaces: the service keeps
		// none, and the two protocols state the same thing about the same act. The protocol answers with a
		// payload and the route answers with the row, which is this domain's convention — so the row is
		// what the two are compared through.
		expect(overGraphql.promotion).toBe(overRest);
		expect(overGraphql.promotion).toBe(DEACTIVATED);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('accepts a deactivation that states no reason, which is what an optional body on the route means', async () => {
		const { service, controller, resolver } = surfaces();

		await controller.deactivate(PROMOTION, {} as never);
		await resolver.deactivatePromotion(PROMOTION);

		expect(service.deactivate).toHaveBeenNthCalledWith(1, PROMOTION, undefined);
		expect(service.deactivate).toHaveBeenNthCalledWith(2, PROMOTION, undefined);
	});

	it('replaces the action set through the same service method the actions route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.replaceActions(PROMOTION, { actions: ACTIONS } as never);
		const overGraphql = await resolver.replacePromotionActions(PROMOTION, { actions: ACTIONS as never });

		// The whole set, unchanged: a replacement is not a merge, and the position of each action is part
		// of its meaning, so a resolver that reordered or filtered the set would change what it means.
		expect(service.replaceActions).toHaveBeenNthCalledWith(1, PROMOTION, ACTIONS);
		expect(service.replaceActions).toHaveBeenNthCalledWith(2, PROMOTION, ACTIONS);

		expect(overGraphql.actions).toBe(overRest);
		expect(overGraphql.actions).toBe(ACTIONS);
	});

	it('dry-runs a promotion through the same service method, with the context the route passes', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.simulate(PROMOTION, CONTEXT as never);
		const overGraphql = await resolver.simulatePromotion(PROMOTION, CONTEXT as never);

		// The route hands its body over unchanged and so does the field: the notices an exclusion produces
		// are the answer, so re-shaping the context would be re-shaping the answer.
		expect(service.simulate).toHaveBeenNthCalledWith(1, PROMOTION, CONTEXT);
		expect(service.simulate).toHaveBeenNthCalledWith(2, PROMOTION, CONTEXT);

		expect(overGraphql.result).toBe(overRest.result);
		expect(overGraphql.allocations).toBe(overRest.allocations);
	});

	it('writes nothing when it simulates, because the route writes nothing either', async () => {
		const { service, resolver } = surfaces();

		await resolver.simulatePromotion(PROMOTION, CONTEXT as never);

		// Asserted on the service's writes rather than on the simulated read, so a resolver that
		// "helpfully" stopped or retired the promotion while previewing it fails here.
		expect(service.deactivate).not.toHaveBeenCalled();
		expect(service.softRemove).not.toHaveBeenCalled();
		expect(service.delete).not.toHaveBeenCalled();
	});

	it('retires a promotion through the same service method the soft-delete route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRemove(PROMOTION);
		const overGraphql = await resolver.softDeletePromotion(PROMOTION);

		// The inherited route hands over its rest parameter, which is an empty ARRAY; `toFindOneOptions`
		// normalises both that and an absent argument to "no find options", so the two are one call.
		expect(service.softRemove).toHaveBeenNthCalledWith(1, PROMOTION, []);
		expect(service.softRemove).toHaveBeenNthCalledWith(2, PROMOTION);
		expect(service.softRemove).toHaveBeenCalledTimes(2);

		expect(overGraphql.promotion).toBe(overRest);
		expect(overGraphql.promotion).toBe(SOFT_DELETED);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('restores a promotion through the same service method the recover route calls', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.softRecover(PROMOTION);
		const overGraphql = await resolver.recoverPromotion(PROMOTION);

		expect(service.softRecover).toHaveBeenNthCalledWith(1, PROMOTION, []);
		expect(service.softRecover).toHaveBeenNthCalledWith(2, PROMOTION);

		expect(overGraphql.promotion).toBe(overRest);
		expect(overGraphql.promotion).toBe(RESTORED);
	});

	it('reports a refusal the caller can act on rather than failing the transport', async () => {
		const { service, resolver } = surfaces();

		// An empty action set is a business rejection the route answers with a 400 and a code; here it is
		// a successful operation carrying the same code, which is what the domain's payload convention is
		// for. A caller that branches on the code does not learn a second vocabulary.
		service.replaceActions.mockRejectedValueOnce(
			new Error('PROMOTION_NO_ACTIONS: a promotion without an action has no effect.')
		);

		const payload = await resolver.replacePromotionActions(PROMOTION, { actions: [] });

		expect(payload.actions).toBeNull();
		expect(payload.userErrors).toHaveLength(1);
		// The code the service raised, not one derived from a status: the client branches on the same
		// string here as it does on the route's error body.
		expect(payload.userErrors[0].code).toBe('PROMOTION_NO_ACTIONS');
		expect(payload.userErrors[0].message).toContain('PROMOTION_NO_ACTIONS');
	});
});

describe('PromotionResolver — the authorisation is the route’s, field by field', () => {
	it('states on every new field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(ROUTE_PARITY.some(({ route }) => permissionOfRoute(route))).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			// The handler is asserted to be there before the two readings are compared — inherited
			// handlers included, which is why the inherited ones are overridden on this controller at
			// all: the base declares its routes with no permission metadata of its own.
			expect(typeof handlersOf(PromotionController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PromotionResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PromotionController)[route])
			);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(route));
		}
	});

	it('demands edit for the three acts, simulate for the dry run and delete for the two lifecycle moves', () => {
		// Stated explicitly as well as by comparison, because these five are the ones a reader will want
		// to see: the class-level grant is only `PROMOTIONS_VIEW`, and a field that left `EDIT`, `SIMULATE`
		// or `DELETE` to the class would extend the view permission into a write — which is the defect
		// this whole wave exists to close.
		expect(permissionOfField('deactivatePromotion')).toEqual([PromotionPermission.PROMOTIONS_EDIT]);
		expect(permissionOfField('replacePromotionActions')).toEqual([PromotionPermission.PROMOTIONS_EDIT]);
		expect(permissionOfField('simulatePromotion')).toEqual([PromotionPermission.PROMOTIONS_SIMULATE]);
		expect(permissionOfField('softDeletePromotion')).toEqual([PromotionPermission.PROMOTIONS_DELETE]);
		expect(permissionOfField('recoverPromotion')).toEqual([PromotionPermission.PROMOTIONS_DELETE]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PromotionResolver)).toEqual([
			PromotionPermission.PROMOTIONS_VIEW
		]);
	});

	it('runs the fields under the controller’s guard chain, plus the gate the endpoint adds', () => {
		const controllerGuards = guardsOf(PromotionController);
		const resolverGuards = guardsOf(PromotionResolver);

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining(controllerGuards));

		for (const { field } of ROUTE_PARITY) {
			expect(guardsOf(PromotionResolver, field)).toEqual(expect.arrayContaining(controllerGuards));
		}
	});
});

/**
 * The one field of this resource that mirrors no route.
 *
 * `PromotionService.expire` moves a promotion to `EXPIRED`, which is what the expiry sweep does when a
 * window closes; the controller serves no route for it, and its `deactivate` route is **not** the same
 * capability: that one moves the promotion to `INACTIVE` and can be reversed by activating it again.
 * `expirePromotion` is therefore a divergence from "one mutation per route" — an extra root field is as
 * much a divergence as a missing one — and it is **recorded here rather than removed**: removing a root
 * field is a breaking change to the schema and the owner's call, not this suite's.
 */
describe('PromotionResolver — the expiry that mirrors no route, and is not the deactivation', () => {
	it('is served by GraphQL and by no handler of the controller', () => {
		expect(typeof fieldsOf(PromotionResolver)['expirePromotion']).toBe('function');
		expect(typeof handlersOf(PromotionController)['expire']).toBe('undefined');
	});

	it('moves the promotion to EXPIRED, where the deactivation moves it to INACTIVE', async () => {
		const { service, resolver } = surfaces();

		await resolver.expirePromotion(PROMOTION);
		await resolver.deactivatePromotion(PROMOTION);

		// Two methods, two states: folding one into the other would report a reversible withdrawal as a
		// closed window. The new field calls `deactivate` and never `expire`.
		expect(service.expire).toHaveBeenCalledWith(PROMOTION);
		expect(service.deactivate).toHaveBeenCalledWith(PROMOTION, undefined);
		expect(service.expire).toHaveBeenCalledTimes(1);
		expect(service.deactivate).toHaveBeenCalledTimes(1);
	});
});
