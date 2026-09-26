/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all seven
 * of this plugin's controllers serve that pair, each overriding it only to state a permission the
 * inherited routes leave unstated, while not one of its seven resolvers declared either field. A client
 * could therefore retire a return, a claim, an exchange, a governed reason or any of their lines
 * recoverably over REST and not over GraphQL, where three of the seven resolvers held no mutation at all
 * and the other four held nothing that withdraws anything. Fourteen fields close that, and three
 * properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the type the
 *   resource's own mutations answer, because a field the document does not carry is one no client can
 *   select and a field whose answer no sibling shares is a second shape invented for one act;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level read grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the service and the base class's two routes.** The seven controllers are
 * the real ones — including the `softRemove` and `softRecover` overrides, which exist only to state the
 * permission the inherited routes leave unstated — the seven resolvers are the real ones, and the
 * document the fields are read out of is the real one. The service is the seam the parity requirement is
 * about: one stub is what makes "the same method with the same identifier" visible without a database
 * behind it.
 *
 * The kernel barrel is doubled for the reason this package's other suites state: `@gauzy/core` boots the
 * whole application graph from its barrel, the demonstration database configuration among it, so a suite
 * that reads one controller through it pays for the platform. Only the two inherited routes are carried
 * across, and they are written here as `CrudController` writes them — `softRemove(id, ...options)` calling
 * `this.crudService.softRemove(id, options)` — so the delegation compared below is the platform's shape
 * and not an invention of this file.
 */

jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the classes under test are declared
	// with the platform's decorators rather than with no-ops.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The CRUD base, as the seven controllers extend it.
	 *
	 * The two inherited routes are the subject of this suite, so they are written as
	 * `packages/core/src/lib/core/crud/crud.controller.ts` writes them — the identifier, the rest
	 * parameter handed over as one array, and the service call — rather than omitted.
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
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The soft-delete and recover routes construct this pipe at class-definition time, so the
		// double has to export the class those routes build.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Versioned: versioned.Versioned,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		// The page window and the connection the list fields answer with are the kernel's own, so a
		// resolver that is loaded here is loaded with the platform's helpers rather than with holes.
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

/** The feature-flag decorator is the only value these modules read from `@gauzy/common`. */
jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag: () => () => undefined
	})
);

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { ReturnsPermissions } from '../../returns.permissions';
import { OrderClaimController } from '../../order-claim/order-claim.controller';
import { OrderClaimLineController } from '../../order-claim-line/order-claim-line.controller';
import { OrderExchangeController } from '../../order-exchange/order-exchange.controller';
import { OrderExchangeLineController } from '../../order-exchange-line/order-exchange-line.controller';
import { OrderReturnController } from '../../order-return/order-return.controller';
import { OrderReturnLineController } from '../../order-return-line/order-return-line.controller';
import { OrderReturnReasonController } from '../../order-return-reason/order-return-reason.controller';
import { schemaExtensions } from '../schema-extensions';
import { OrderClaimLineResolver } from './order-claim-line.resolver';
import { OrderClaimResolver } from './order-claim.resolver';
import { OrderExchangeLineResolver } from './order-exchange-line.resolver';
import { OrderExchangeResolver } from './order-exchange.resolver';
import { OrderReturnLineResolver } from './order-return-line.resolver';
import { OrderReturnReasonResolver } from './order-return-reason.resolver';
import { OrderReturnResolver } from './order-return.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a return over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the seven resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The type its field answers with: what the resource's other mutations answer in this plugin. */
	answers: string;
	/**
	 * The payload member carrying the row, or null when the field answers the row itself.
	 *
	 * Four of the seven resources answer a payload whose other mutations carry the row and the refused
	 * errors; the three lines have no payload of their own in this document and answer the row, which is
	 * what their REST routes answer too.
	 */
	carries: string | null;
	/** The grant its own routes state, which is what the fields must state. */
	edit: PermissionsEnum;
	/** The grant its class states, which the fields must not leave the act to. */
	view: PermissionsEnum;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/** The seven resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'OrderReturn',
		answers: 'RequestOrderReturnPayload',
		carries: 'orderReturn',
		edit: ReturnsPermissions.RETURNS_CREATE,
		view: ReturnsPermissions.RETURNS_VIEW,
		controller: OrderReturnController,
		resolver: OrderReturnResolver
	},
	{
		name: 'OrderReturnLine',
		answers: 'OrderReturnLine',
		carries: null,
		edit: ReturnsPermissions.RETURNS_CREATE,
		view: ReturnsPermissions.RETURNS_VIEW,
		controller: OrderReturnLineController,
		resolver: OrderReturnLineResolver
	},
	{
		name: 'OrderReturnReason',
		answers: 'OrderReturnReasonPayload',
		carries: 'orderReturnReason',
		edit: ReturnsPermissions.RETURNS_CREATE,
		view: ReturnsPermissions.RETURNS_VIEW,
		controller: OrderReturnReasonController,
		resolver: OrderReturnReasonResolver
	},
	{
		name: 'OrderClaim',
		answers: 'RequestOrderClaimPayload',
		carries: 'orderClaim',
		edit: ReturnsPermissions.CLAIMS_CREATE,
		view: ReturnsPermissions.CLAIMS_VIEW,
		controller: OrderClaimController,
		resolver: OrderClaimResolver
	},
	{
		name: 'OrderClaimLine',
		answers: 'OrderClaimLine',
		carries: null,
		edit: ReturnsPermissions.CLAIMS_CREATE,
		view: ReturnsPermissions.CLAIMS_VIEW,
		controller: OrderClaimLineController,
		resolver: OrderClaimLineResolver
	},
	{
		name: 'OrderExchange',
		answers: 'RequestOrderExchangePayload',
		carries: 'orderExchange',
		edit: ReturnsPermissions.EXCHANGES_CREATE,
		view: ReturnsPermissions.EXCHANGES_VIEW,
		controller: OrderExchangeController,
		resolver: OrderExchangeResolver
	},
	{
		name: 'OrderExchangeLine',
		answers: 'OrderExchangeLine',
		carries: null,
		edit: ReturnsPermissions.EXCHANGES_CREATE,
		view: ReturnsPermissions.EXCHANGES_VIEW,
		controller: OrderExchangeLineController,
		resolver: OrderExchangeLineResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The fourteen fields, built from the seven resources so a resource cannot be listed with only half a
 * pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this
 * kind already use — the one `restore<Type>` is the specification's own naming table and is not this
 * plugin's to extend.
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

	// Three of the seven resolvers take further collaborators — a claim's lines and its inbound return,
	// an exchange's lines, a return's lines and its reason — and no field of the pair reads any of them.
	return {
		service,
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(service, service, service) as Row
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
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

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
		throw new Error('the returns document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the returns document declares no Mutation field named "${name}"`);
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
 * The schema's half of the pair.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the returns document — the seven inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers what the resource’s own mutations answer, which is what its route answers', () => {
		// Four of the seven resources answer a payload here — the refusal travels in `userErrors` rather
		// than as a GraphQL error, as every other mutation of those resources reports it — and the three
		// lines answer the row, which is what the REST routes answer and what no payload of this document
		// carries.
		for (const { field, answers } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'requestOrderReturn',
			'approveOrderReturn',
			'rejectOrderReturn',
			'receiveOrderReturn',
			'cancelOrderReturn',
			'closeOrderReturn',
			'createOrderReturnReason',
			'updateOrderReturnReason',
			'deleteOrderReturnReason',
			'requestOrderClaim',
			'approveOrderClaim',
			'rejectOrderClaim',
			'requestOrderExchange',
			'approveOrderExchange',
			'rejectOrderExchange'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` follows the specification's own naming table instead. A second spelling here is a
		// second vocabulary for one capability, and a client that guessed the other one would find no
		// field rather than an error it could act on.
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

		// One answer, one implementation: the row either surface acted on is the same row, and the
		// payload-wrapped answers carry it in the member this plugin's other mutations use.
		const expected = entry.method === 'softRemove' ? RETIRED : RESTORED;

		expect(overRest).toBe(expected);
		expect(entry.carries ? overGraphql[entry.carries] : overGraphql).toBe(expected);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes a return, a claim, an exchange, a
 * governed reason or a line out of every resolution, and a recover puts it back into what money, stock
 * and history point at — so a field that left the grant to its class would extend the read permission
 * into a write. That is the defect the controllers' own overrides exist to close on the other surface,
 * and the one a GraphQL caller would otherwise reach it through.
 */
describe('the soft-delete pair — the permission and the guards are the route’s', () => {
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

	it('demands the writing grant, which is the grant the fourteen overrides state', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of all seven resolvers is the VIEW grant, and a field that left the act to its
		// class would let a reader retire or restore a return, a claim, an exchange, a reason or a line.
		for (const { field, route, controller, resolver, edit, view } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([edit]);
			expect(permissionOfRoute(controller, route)).toEqual([edit]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([view]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(OrderReturnController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});
