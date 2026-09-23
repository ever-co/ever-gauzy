/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all four of
 * this plugin's controllers serve that pair while not one of its four resolvers declared either field.
 * A client could therefore retire a plan, a subscription, a recurring line or a billing cycle
 * recoverably over REST and not over GraphQL, where the only deletion-shaped field it held was the
 * destructive one. Eight fields close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the payload
 *   its siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, and the rest of what its route states, read from the
 *   route's metadata rather than restated here — so a caller holding only the class-level view grant is
 *   refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * The four controllers are the real ones, the four resolvers are the real ones, and the document the
 * fields are read out of is the real one. What is doubled is `@gauzy/core`, which boots the whole
 * application graph from its barrel — configuration, the ORM, the module scanner — and cannot be loaded
 * outside a running application, as this package's other specs record.
 *
 * The one part of that double the assertions lean on is `CrudController`: both a route and a field have
 * to reach the service, and the base is what carries the delegation it does so through. It therefore
 * models the kernel's own two bodies (`crud.controller.ts`):
 *
 * ```ts
 * async softRemove(id, ...options) { return await this.crudService.softRemove(id, options); }
 * ```
 *
 * — the rest parameter is handed over as the array it is, which is why the route and the field below
 * are one call with two spellings of "no find options" rather than two different calls.
 */
jest.mock('@gauzy/common', () => ({
	/** A no-op decorator factory: the feature gate is not what these cases are about. */
	FeatureFlag: () => () => undefined
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: no controller here is mapped onto a Nest application. */
	const decorator = () => () => undefined;
	// The kernel's own decorators where a case reads what they write: the permission a field states and
	// the conventions it does or does not adopt are metadata, so a double of either would let a field
	// disagree with its route and still pass.
	const permissions = jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const concurrency = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');
	const connection = jest.requireActual('@gauzy/core/src/lib/api/graphql-connection');

	/**
	 * The two inherited routes, with the kernel's own delegations.
	 *
	 * This plugin's controllers override both, so what a field is compared against is the override's
	 * hand-over and the base's one-line call to the service — the same call the field makes.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}

		async softRemove(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRemove(id, options);
		}

		async softRecover(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRecover(id, options);
		}
	}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}
	}

	return {
		ExportRedacted: decorator,
		CrudController,
		CrudService,
		TenantAwareCrudService,
		Permissions: permissions.Permissions,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		VERSIONED_METADATA_KEY: concurrency.VERSIONED_METADATA_KEY,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		BaseQueryDTO: class {},
		TenantOrganizationBaseDTO: class {},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		// `@UsePipes(new AbstractValidationPipe(...))` on the inherited mutating routes is evaluated when
		// the controller class is defined, and Nest requires a pipe to expose `transform`, so the double
		// has to as well.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		VersionedColumn: decorator,
		JsonColumn: decorator,
		BaseEntity: class {},
		TenantBaseEntity: class {},
		TenantOrganizationBaseEntity: class {},
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		divideDecimalUnits: jest.requireActual('@gauzy/core/src/lib/money/decimal').divideDecimalUnits,
		formatDecimalUnits: jest.requireActual('@gauzy/core/src/lib/money/decimal').formatDecimalUnits,
		// The page window and the cursor codec the list fields page with are the kernel's own: a double of
		// the module this plugin re-exports would let the two surfaces drift in a suite that still passed.
		DEFAULT_CONNECTION_PAGE_SIZE: connection.DEFAULT_CONNECTION_PAGE_SIZE,
		MAX_CONNECTION_PAGE_SIZE: connection.MAX_CONNECTION_PAGE_SIZE,
		resolveConnectionWindow: connection.resolveConnectionWindow,
		connectionFromOffsetPage: connection.connectionFromOffsetPage,
		decodeOffsetCursor: connection.decodeOffsetCursor,
		encodeOffsetCursor: connection.encodeOffsetCursor,
		paginateRows: connection.paginateRows
	};
});

// The collaborators a resolver injects are doubled at their own modules, so nothing below them is
// loaded: what these cases assert is which service method each surface reaches, not what it returns.
jest.mock('../../subscription/subscription.service', () => ({ SubscriptionService: class SubscriptionService {} }));
jest.mock('../../subscription-plan/subscription-plan.service', () => ({
	SubscriptionPlanService: class SubscriptionPlanService {}
}));
jest.mock('../../subscription-item/subscription-item.service', () => ({
	SubscriptionItemService: class SubscriptionItemService {}
}));
jest.mock('../../subscription-billing/subscription-billing.service', () => ({
	SubscriptionBillingService: class SubscriptionBillingService {}
}));

import { HttpException } from '@nestjs/common';
import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IDEMPOTENT_METADATA_KEY, PermissionGuard, TenantPermissionGuard, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionBillingController } from '../../subscription-billing/subscription-billing.controller';
import { SubscriptionItemController } from '../../subscription-item/subscription-item.controller';
import { SubscriptionPlanController } from '../../subscription-plan/subscription-plan.controller';
import { SubscriptionController } from '../../subscription/subscription.controller';
import { schemaExtensions } from '../schema-extensions';
import { SubscriptionBillingResolver } from './subscription-billing.resolver';
import { SubscriptionItemResolver } from './subscription-item.resolver';
import { SubscriptionPlanResolver } from './subscription-plan.resolver';
import { SubscriptionResolver } from './subscription.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a subscription over GraphQL and one
 * that retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the four resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The payload type the SDL declares for the resource's mutations. */
	payload: string;
	/** The member of that payload the returned row rides on. */
	member: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/** The four resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'SubscriptionPlan',
		payload: 'SubscriptionPlanPayload',
		member: 'subscriptionPlan',
		controller: SubscriptionPlanController,
		resolver: SubscriptionPlanResolver
	},
	{
		name: 'Subscription',
		payload: 'CustomerSubscriptionPayload',
		member: 'subscription',
		controller: SubscriptionController,
		resolver: SubscriptionResolver
	},
	{
		name: 'SubscriptionItem',
		payload: 'SubscriptionItemPayload',
		member: 'subscriptionItem',
		controller: SubscriptionItemController,
		resolver: SubscriptionItemResolver
	},
	{
		name: 'SubscriptionBilling',
		payload: 'SubscriptionBillingPayload',
		member: 'subscriptionBilling',
		controller: SubscriptionBillingController,
		resolver: SubscriptionBillingResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The eight fields, built from the four resources so a resource cannot be listed with only half a pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this
 * kind already use.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{ ...resource, field: `softDelete${resource.name}`, route: 'softRemove', method: 'softRemove' },
	{ ...resource, field: `recover${resource.name}`, route: 'softRecover', method: 'softRecover' }
]);

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const service = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};

	return {
		service,
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(service) as Row
	};
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` (`shared/guards/permission.guard.ts`) then answers `true`
 * to when the pair is empty.
 *
 * @param controller The controller the route belongs to.
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
 */
function permissionOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, resolver)
	);
}

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? (Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? []) : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the subscription document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the subscription document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` included. */
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
 * The schema's half of the pair.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the subscription document — the four inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers the payload the resource’s other mutations answer, carrying the row', () => {
		// The REST routes answer the row they retired or restored, and this plugin's mutations answer a
		// payload; the payload is therefore the row-carrying one rather than the id-only one a hard delete
		// uses, because a delete route has nothing but the identifier it was handed to answer with.
		for (const { field, payload } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(payload);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createSubscriptionPlan',
			'updateSubscriptionPlan',
			'deleteSubscriptionPlan',
			'createSubscription',
			'updateSubscription',
			'activateSubscription',
			'pauseSubscription',
			'resumeSubscription',
			'cancelSubscription',
			'expireSubscription',
			'changeSubscriptionPlan',
			'addSubscriptionItem',
			'changeSubscriptionItemQuantity',
			'removeSubscriptionItem',
			'createSubscriptionItem',
			'updateSubscriptionItem',
			'deleteSubscriptionItem',
			'createSubscriptionBilling',
			'updateSubscriptionBilling',
			'billSubscription',
			'runSubscriptionBilling',
			'paySubscriptionBilling',
			'waiveSubscriptionBilling',
			'refundSubscriptionBilling'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is being corrected. A second spelling is a second vocabulary for one capability, and a
		// client that guessed the other one would find no field rather than an error it could act on.
		const restored = mutationFields()
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('restore'));

		expect(restored).toEqual([]);
		expect(mutationFields().map((field) => field.name.value)).toEqual(
			expect.arrayContaining(PARITY.filter(({ route }) => route === 'softRecover').map(({ field }) => field))
		);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the soft-delete pair — the two protocols retire and restore the same row', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](ID);
		const overGraphql = await resolver[entry.field](ID);

		// The inherited route hands over its rest parameter, which is an empty ARRAY, and the service
		// normalises both that and an absent argument to "no find options" — so the two are one call.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, []);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface acted on is the same row.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql[entry.member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it.each(RESOURCES)(
		'answers a refusal on $name the way its siblings do, as a user error',
		async ({ name, member, resolver }) => {
			// The convention every mutation of this plugin follows: an outcome the caller could have avoided is
			// reported in the payload with the operation succeeding, and only a request that could not have been
			// made correctly becomes a GraphQL error. A field of the pair that threw instead would be the one
			// mutation of the resource a client could not branch on.
			const service = { softRemove: jest.fn().mockRejectedValue(new HttpException('not found', 404)) };
			const answer = await (new resolver(service) as Row)[`softDelete${name}`](ID);

			expect(answer[member]).toBeNull();
			expect(answer.userErrors).toEqual([{ code: 'NOT_FOUND', message: 'not found', path: [], details: null }]);
		}
	);
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes a row out of every read and a recover
 * puts it back into what a customer is charged — so a field that left the grant to its class would extend
 * the read permission into a write. That is the defect the controllers' own overrides exist to close on
 * the other surface, and the one a GraphQL caller would otherwise reach it through.
 */
describe('the soft-delete pair — the permission, the guards and the conventions are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			// The override is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the edit grant, which is the grant the four overrides state', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of all four resolvers is the VIEW grant, and a field that left the act to its
		// class would let a reader retire or restore a subscription, a plan, a line or a cycle.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([SubscriptionPermissions.SUBSCRIPTIONS_EDIT]);
			expect(permissionOfRoute(controller, route)).toEqual([SubscriptionPermissions.SUBSCRIPTIONS_EDIT]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([
				SubscriptionPermissions.SUBSCRIPTIONS_VIEW
			]);
		}
	});

	it('adopts no version and no retry key, exactly as its route adopts neither', () => {
		// The pair is the one part of this plugin's write surface that states neither convention: a soft
		// delete and a recover are not predicated on a version the caller read, and a retry of one is
		// answered by the row's own state rather than from a record of the first attempt. A field that
		// added either would ask callers for something its route never asks for, and a client that moved
		// between protocols would have to know which of them wanted it.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
		}

		// The control: the readings above are of metadata that is really written elsewhere on both surfaces,
		// so "undefined" here means the pair states neither rather than that neither decorator ran.
		const subscription = PARITY.find(({ name }) => name === 'Subscription');
		expect(
			Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(SubscriptionResolver)['updateSubscription'])
		).toBeDefined();
		expect(
			Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(subscription!.controller)['activate'])
		).toBeDefined();
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(SubscriptionController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});
