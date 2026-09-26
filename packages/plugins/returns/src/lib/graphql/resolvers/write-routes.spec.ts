/**
 * The write routes of this package that no field answered, and the reading that collapsed or refused the
 * rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **twenty-two** of this package's
 * fifty-two write routes — which is not a gap count, because the instrument is blind in the two
 * directions that matter here. It expects a CRUD handler to be answered by `<verb><Resource>`
 * (`softRemove` → `softDelete<Resource>`, `softRecover` → `recover<Resource>`), and for a domain verb it
 * looks for the verb *anywhere* in a field's name beside the first five letters of the resource — which
 * for this package is the string `order` for **all seven** resources, so its verb test degenerates to
 * "does any field name contain the verb and the word order".
 *
 * That last defect costs it four routes and those four are asserted below beside the twenty-two. It
 * counts `POST /order-claims/:id/cancel` and `POST /order-exchanges/:id/cancel` as answered because
 * `cancelOrderReturn` carries both the verb and `order` — a field of a **different resource** — and it
 * counts `POST /order-claims/:id/close` and `POST /order-exchanges/:id/close` as answered by
 * `closeOrderReturn` for the same reason. An independent reading that narrows the stem from
 * `resource.slice(0, 5)` to the resource's own full name flags all four, and this suite is the third
 * instrument: it drives the two surfaces and compares the service calls, which is what a name cannot do.
 *
 * The twenty-six are four buckets, and every row of all four is asserted rather than described:
 *
 * - **Eleven genuine gaps**, which this suite is mostly about: the update, refund, shipping and
 *   destructive-delete routes of the return, the update, cancel and destructive-delete routes of the
 *   claim and of the exchange, and the physical removal of a governed return reason. Each is a
 *   capability a REST caller has and a GraphQL caller did not, and each is delivered here with the
 *   arguments its route takes, the permission its route states and the same service call.
 * - **Four naming variants**, where the capability is already reachable: the three request verbs
 *   (`createOrderReturn` is `requestOrderReturn`, and its two siblings likewise, which is the name
 *   `17-graphql-api-specification.md` §3.2 row 27 gives the act) and the reason's reactivation, which is
 *   a one-field write through `updateOrderReturnReason`.
 * - **Nine child-through-parent routes**: the create, update and delete of the three line resources.
 *   Every one is a row that cannot exist without its parent — `05-database-schema-specification.md` §3
 *   classes `order_return_line`, `order_claim_line` and `order_exchange_line` as "Child owned by an
 *   aggregate ("part-of") … the child cannot exist without its parent", and their tables carry
 *   `CASCADE` from the aggregate — and its rows are written as a **set** by the parent's own field:
 *   the line's create is `requestOrderReturn(input.lines)`, and its edit is the parent's line-set
 *   replace, `updateOrderReturn`. The removal the design exposes is the recoverable pair the resource
 *   serves, and the destructive per-line route is not a catalogued route at all.
 * - **Two routes the specifications refuse to mirror**, and the refusal is cited where it is made:
 *   `POST /order-claims/:id/close` and `POST /order-exchanges/:id/close`. `10-orders-payments-and-
 *   returns-spec.md` §12.6 states the rule in as many words — "`CLAIM_RESOLVE` and `EXCHANGE_RESOLVE`
 *   are the only writers of claim and exchange state" — and §12.1 and §12.2 give `CLOSED` to those
 *   operations alone ("APPROVED --> CLOSED : CLAIM_RESOLVE applied"). A field mirroring the route would
 *   be a second writer of state the design gives one, and `06-api-specification.md` §7.14 declares no
 *   close route for either resource.
 *
 * Three properties are pinned for each of the eleven, exactly as the lifecycle pair's suite pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the payload its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of all four of these
 *   controllers is the *view* grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches** — every delegation the
 *   route makes, in the order it makes them — because two protocols that perform one act differently are
 *   two behaviours waiting to diverge. It mirrors the route's `@Versioned` expectation where the route
 *   declares one, which the return's three versioned writes do, and it mirrors the route's silence where
 *   it declares none.
 *
 * **Two divergences between the routes and `06-api-specification.md` §7.14 are pinned rather than
 * papered over**, because a field has to be one thing or the other and this programme's rule is that it
 * mirrors the route. §7.14 gives `POST /order-returns/:id/refund` the grant `REFUNDS_CREATE`; the route
 * states `RETURNS_RECEIVE`, and the field states `RETURNS_RECEIVE` with it. §7.14 marks the refund and
 * the shipping route "Yes (Idempotency-Key)", with the refund's required; the routes declare no
 * `@Idempotent` at all — the controller's two decorators sit on the request and the receipt — and no
 * field invents a scope, because a scope invented here would replay a GraphQL retry that the REST route
 * lets through, which is a difference in behaviour rather than in transport. Both are asserted below as
 * measurements, so whoever settles them changes both surfaces together.
 *
 * **Nothing is doubled here but the services.** The four controllers are the real ones, the four
 * resolvers are the real ones with their own decorators and signatures, `CrudController` behind them is
 * written as the kernel writes it, and the document the fields are read out of is the real one. A
 * resolver's other collaborators are stubs of their own rather than copies of the one under test, so a
 * field that reached the wrong service is visible instead of passing on a shared double.
 *
 * The kernel barrel is doubled for the reason this package's other suites state: `@gauzy/core` boots the
 * whole application graph from its barrel, the demonstration database configuration among it, so a suite
 * that reads one controller through it pays for the platform. The one inherited route this suite drives
 * is carried across, written as `CrudController` writes it — `delete(id)` calling `this.crudService.delete(id)`
 * — so the delegation compared below is the platform's shape and not an invention of this file.
 */

jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the classes under test are declared
	// with the platform's decorators rather than with no-ops.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');
	const versionUtil = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The CRUD base, as the four controllers extend it.
	 *
	 * The destructive route is the subject of one row per aggregate here, so it is written as
	 * `packages/core/src/lib/core/crud/crud.controller.ts` writes it — the identifier, and the service
	 * call — rather than omitted.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}
		async delete(id: any, ...options: any[]): Promise<any> {
			return this.crudService.delete(id);
		}
		async softRemove(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRemove(id, options);
		}
		async softRecover(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRecover(id, options);
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
		// The key the decorator above writes, so the suite can read back what each surface declared.
		VERSIONED_METADATA_KEY: versionUtil.VERSIONED_METADATA_KEY,
		VERSION_EXPECTATION_PROPERTY: versionUtil.VERSION_EXPECTATION_PROPERTY,
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

import { getMetadataStorage } from 'class-validator';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSION_EXPECTATION_PROPERTY,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ReturnsPermissions } from '../../returns.permissions';
import { EditOrderClaimDTO } from '../../order-claim/dto';
import { OrderClaimController } from '../../order-claim/order-claim.controller';
import { OrderClaimLineController } from '../../order-claim-line/order-claim-line.controller';
import { EditOrderExchangeDTO } from '../../order-exchange/dto';
import { OrderExchangeController } from '../../order-exchange/order-exchange.controller';
import { OrderExchangeLineController } from '../../order-exchange-line/order-exchange-line.controller';
import { EditOrderReturnDTO, RefundOrderReturnDTO, ShipOrderReturnDTO } from '../../order-return/dto';
import { OrderReturnController } from '../../order-return/order-return.controller';
import { OrderReturnLineController } from '../../order-return-line/order-return-line.controller';
import { OrderReturnReasonController } from '../../order-return-reason/order-return-reason.controller';
import { schemaExtensions } from '../schema-extensions';
import { OrderClaimResolver } from './order-claim.resolver';
import { OrderExchangeResolver } from './order-exchange.resolver';
import { OrderReturnResolver } from './order-return.resolver';
import { OrderReturnReasonResolver } from './order-return-reason.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';
const OPTION = '00000000-0000-4000-8000-000000000011';
const WAREHOUSE = '00000000-0000-4000-8000-000000000012';
const REASON = '00000000-0000-4000-8000-000000000013';
const ORDER_LINE = '00000000-0000-4000-8000-000000000014';
const VARIANT = '00000000-0000-4000-8000-000000000015';

/** The prose both surfaces keep, which is the operator's and not the service's. */
const NOTE = 'customer asked for a different size';
const TRACKING = 'RR123456789GB';
const AMOUNT = '25.000000';

/** The line sets both surfaces replace, one per resource's own line shape. */
const RETURN_LINES = [{ orderLineId: ORDER_LINE, quantity: '2.000000', reasonId: REASON, restock: true }];
const CLAIM_LINES = [{ orderLineId: ORDER_LINE, quantity: '1.000000', reason: 'DAMAGED' }];
const EXCHANGE_LINES = [{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1.000000' }];

/**
 * The bodies each route validates, stated in full so the two surfaces build the same patch.
 *
 * Every member of each DTO is stated rather than left absent, because the two handlers derive what they
 * write differently — the route destructures the body it was handed and the field builds its patch from
 * the members it names — and a member left out of one object would make that comparison depend on how
 * each of them treats an absent key rather than on what either of them writes.
 */
const RETURN_EDIT = { lines: RETURN_LINES, warehouseId: WAREHOUSE, reason: NOTE, note: NOTE };
const CLAIM_EDIT = { lines: CLAIM_LINES, reason: NOTE, note: NOTE };
const EXCHANGE_EDIT = { lines: EXCHANGE_LINES, allowBackorder: true, note: NOTE };

/** The three bodies that carry a single member each beside the identifier. */
const REFUND_BODY = { amount: AMOUNT, reasonId: REASON, note: NOTE };
const SHIP_BODY = { shippingOptionId: OPTION, warehouseId: WAREHOUSE, trackingNumber: TRACKING };
const CANCEL_BODY = { reason: NOTE };

/**
 * The version the caller accepted, as the guard leaves it on the request.
 *
 * Both surfaces read it through the same `versionExpectationOf`, from the same request object, so the
 * expectation the service receives is one value compared against itself rather than two constructions
 * that happen to agree.
 */
const ACCEPTED = { wildcard: false, versions: [3] };
const REQUEST = { [VERSION_EXPECTATION_PROPERTY]: ACCEPTED };

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that edits a return over GraphQL and one that
 * edits it over REST must be looking at the same record afterwards.
 */
const RETURN = { id: ID, number: 'RET-0001', status: 'OPEN', version: 4 };
const CLAIM = { id: ID, number: 'CLM-0001', status: 'OPEN' };
const EXCHANGE = { id: ID, number: 'EXC-0001', status: 'OPEN' };
const LINES = [{ id: `${ID}-line` }];
const REFUNDED = { refundId: `${ID}-refund`, amount: AMOUNT, currency: 'USD' };
const LEG = { fulfillmentId: `${ID}-leg`, trackingNumber: TRACKING, labelUrl: 'https://carrier.example/l/1' };
const REMOVED = { affected: 1, raw: [] };

/**
 * What a collaborator other than the resource's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/** The service that owns one capability, which is the stub the field has to reach. */
type ServiceKey = 'orderReturn' | 'orderClaim' | 'orderExchange' | 'orderReturnReason';

/**
 * The methods any of the eleven fields and their routes could reach, which every stub therefore carries.
 *
 * A collaborator is only useful as a negative control if it *could* have answered the call: a stub
 * without the method would make "no other service was touched" pass on an absence rather than on a
 * measurement.
 */
const CAPABILITY_METHODS = [
	'applyVersionedUpdate',
	'replaceLines',
	'findOneDetailed',
	'refund',
	'createShipment',
	'update',
	'cancel',
	'delete',
	'deactivate',
	'softRemove',
	'softRecover',
	'create',
	'approve',
	'reject',
	'close'
];

/**
 * One of the eleven routes, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for, which for the verb-shaped rows is the verb itself. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces, for the method below. */
	serviceArgs: any[];
	/** The further delegations both surfaces make, in the order the route makes them. */
	alsoCalls: [string, any[]][];
	/** The member the payload carries the answer under. */
	member: string;
	/** The member the *route's* answer carries it under, when the route answers a different shape. */
	routeMember?: string;
	/**
	 * Whether the payload carries the identifier that was removed rather than the route's answer.
	 *
	 * The three destructive deletes answer an `UpdateResult` and the physical removal answers a
	 * `DeleteResult`, so there is no row to compare by identity — the fact both surfaces agree on is
	 * *which* row went.
	 */
	answersId?: boolean;
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: PermissionsEnum;
	/** The method both surfaces must reach, checked by the two assertions above. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The eleven routes no field answered.
 *
 * Each is a capability rather than a spare route: editing a return or a claim or an exchange before it
 * is decided, refunding a received return after the receive window has closed, sending the goods back,
 * cancelling a claim or an exchange, and the four destructive removals the framework's base controller
 * serves. None of them was reachable, because the fields that existed moved a status, spent money or
 * retired a row recoverably and none of them wrote what these write.
 */
const PARITY: IParity[] = [
	{
		field: 'updateOrderReturn',
		route: 'update',
		resource: 'OrderReturn',
		expects: 'updateOrderReturn',
		routeArgs: [ID, RETURN_EDIT, REQUEST],
		fieldArgs: [ID, RETURN_EDIT, { req: REQUEST }],
		serviceArgs: [ID, { warehouseId: WAREHOUSE, reason: NOTE, note: NOTE }, ACCEPTED],
		alsoCalls: [
			['replaceLines', [ID, RETURN_LINES]],
			['findOneDetailed', [ID]]
		],
		member: 'orderReturn',
		declared: [
			['id', 'ID'],
			['input', 'UpdateOrderReturnInput']
		],
		answers: 'RequestOrderReturnPayload',
		grant: ReturnsPermissions.RETURNS_CREATE,
		method: 'applyVersionedUpdate',
		service: 'orderReturn',
		controller: OrderReturnController,
		resolver: OrderReturnResolver,
		build: (stubs) => ({
			controller: new OrderReturnController(stubs.orderReturn) as Row,
			resolver: new OrderReturnResolver(stubs.orderReturn, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'refundOrderReturn',
		route: 'refund',
		resource: 'OrderReturn',
		expects: 'refund',
		routeArgs: [ID, REFUND_BODY, REQUEST],
		fieldArgs: [ID, REFUND_BODY, { req: REQUEST }],
		serviceArgs: [ID, AMOUNT, REASON, NOTE, ACCEPTED],
		alsoCalls: [],
		member: 'refundId',
		routeMember: 'refundId',
		declared: [
			['id', 'ID'],
			['input', 'RefundOrderReturnInput']
		],
		answers: 'RefundOrderReturnPayload',
		grant: ReturnsPermissions.RETURNS_RECEIVE,
		method: 'refund',
		service: 'orderReturn',
		controller: OrderReturnController,
		resolver: OrderReturnResolver,
		build: (stubs) => ({
			controller: new OrderReturnController(stubs.orderReturn) as Row,
			resolver: new OrderReturnResolver(stubs.orderReturn, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'shipOrderReturn',
		route: 'shipping',
		resource: 'OrderReturn',
		expects: 'shipping',
		routeArgs: [ID, SHIP_BODY, REQUEST],
		fieldArgs: [ID, SHIP_BODY, { req: REQUEST }],
		serviceArgs: [
			ID,
			{ shippingOptionId: OPTION, warehouseId: WAREHOUSE, trackingNumber: TRACKING },
			ACCEPTED
		],
		alsoCalls: [],
		member: 'fulfillmentId',
		routeMember: 'fulfillmentId',
		declared: [
			['id', 'ID'],
			['input', 'ShipOrderReturnInput']
		],
		answers: 'ShipOrderReturnPayload',
		grant: ReturnsPermissions.RETURNS_CREATE,
		method: 'createShipment',
		service: 'orderReturn',
		controller: OrderReturnController,
		resolver: OrderReturnResolver,
		build: (stubs) => ({
			controller: new OrderReturnController(stubs.orderReturn) as Row,
			resolver: new OrderReturnResolver(stubs.orderReturn, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'deleteOrderReturn',
		route: 'delete',
		resource: 'OrderReturn',
		expects: 'deleteOrderReturn',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		member: 'id',
		answersId: true,
		declared: [['id', 'ID']],
		answers: 'DeleteOrderReturnPayload',
		grant: ReturnsPermissions.RETURNS_CREATE,
		method: 'delete',
		service: 'orderReturn',
		controller: OrderReturnController,
		resolver: OrderReturnResolver,
		build: (stubs) => ({
			controller: new OrderReturnController(stubs.orderReturn) as Row,
			resolver: new OrderReturnResolver(stubs.orderReturn, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'hardDeleteOrderReturnReason',
		route: 'hardDelete',
		resource: 'OrderReturnReason',
		expects: 'hardDelete',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		member: 'id',
		answersId: true,
		declared: [['id', 'ID']],
		answers: 'DeleteOrderReturnReasonPayload',
		grant: ReturnsPermissions.RETURNS_CREATE,
		method: 'delete',
		service: 'orderReturnReason',
		controller: OrderReturnReasonController,
		resolver: OrderReturnReasonResolver,
		build: (stubs) => ({
			controller: new OrderReturnReasonController(stubs.orderReturnReason) as Row,
			resolver: new OrderReturnReasonResolver(stubs.orderReturnReason) as Row
		})
	},
	{
		field: 'updateOrderClaim',
		route: 'update',
		resource: 'OrderClaim',
		expects: 'updateOrderClaim',
		routeArgs: [ID, CLAIM_EDIT],
		fieldArgs: [ID, CLAIM_EDIT],
		serviceArgs: [ID, { reason: NOTE, note: NOTE }],
		alsoCalls: [
			['replaceLines', [ID, CLAIM_LINES]],
			['findOneDetailed', [ID]]
		],
		member: 'orderClaim',
		declared: [
			['id', 'ID'],
			['input', 'UpdateOrderClaimInput']
		],
		answers: 'RequestOrderClaimPayload',
		grant: ReturnsPermissions.CLAIMS_CREATE,
		method: 'update',
		service: 'orderClaim',
		controller: OrderClaimController,
		resolver: OrderClaimResolver,
		build: (stubs) => ({
			controller: new OrderClaimController(stubs.orderClaim) as Row,
			resolver: new OrderClaimResolver(stubs.orderClaim, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'cancelOrderClaim',
		route: 'cancel',
		resource: 'OrderClaim',
		expects: 'cancel',
		routeArgs: [ID, CANCEL_BODY],
		fieldArgs: [ID, NOTE],
		serviceArgs: [ID, NOTE],
		alsoCalls: [],
		member: 'orderClaim',
		declared: [
			['id', 'ID'],
			['reason', 'String']
		],
		answers: 'RequestOrderClaimPayload',
		grant: ReturnsPermissions.CLAIMS_CREATE,
		method: 'cancel',
		service: 'orderClaim',
		controller: OrderClaimController,
		resolver: OrderClaimResolver,
		build: (stubs) => ({
			controller: new OrderClaimController(stubs.orderClaim) as Row,
			resolver: new OrderClaimResolver(stubs.orderClaim, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'deleteOrderClaim',
		route: 'delete',
		resource: 'OrderClaim',
		expects: 'deleteOrderClaim',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		member: 'id',
		answersId: true,
		declared: [['id', 'ID']],
		answers: 'DeleteOrderClaimPayload',
		grant: ReturnsPermissions.CLAIMS_CREATE,
		method: 'delete',
		service: 'orderClaim',
		controller: OrderClaimController,
		resolver: OrderClaimResolver,
		build: (stubs) => ({
			controller: new OrderClaimController(stubs.orderClaim) as Row,
			resolver: new OrderClaimResolver(stubs.orderClaim, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'updateOrderExchange',
		route: 'update',
		resource: 'OrderExchange',
		expects: 'updateOrderExchange',
		routeArgs: [ID, EXCHANGE_EDIT],
		fieldArgs: [ID, EXCHANGE_EDIT],
		serviceArgs: [ID, { allowBackorder: true, note: NOTE }],
		alsoCalls: [
			['replaceLines', [ID, EXCHANGE_LINES]],
			['findOneDetailed', [ID]]
		],
		member: 'orderExchange',
		declared: [
			['id', 'ID'],
			['input', 'UpdateOrderExchangeInput']
		],
		answers: 'RequestOrderExchangePayload',
		grant: ReturnsPermissions.EXCHANGES_CREATE,
		method: 'update',
		service: 'orderExchange',
		controller: OrderExchangeController,
		resolver: OrderExchangeResolver,
		build: (stubs) => ({
			controller: new OrderExchangeController(stubs.orderExchange) as Row,
			resolver: new OrderExchangeResolver(stubs.orderExchange, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'cancelOrderExchange',
		route: 'cancel',
		resource: 'OrderExchange',
		expects: 'cancel',
		routeArgs: [ID, CANCEL_BODY],
		fieldArgs: [ID, NOTE],
		serviceArgs: [ID, NOTE],
		alsoCalls: [],
		member: 'orderExchange',
		declared: [
			['id', 'ID'],
			['reason', 'String']
		],
		answers: 'RequestOrderExchangePayload',
		grant: ReturnsPermissions.EXCHANGES_CREATE,
		method: 'cancel',
		service: 'orderExchange',
		controller: OrderExchangeController,
		resolver: OrderExchangeResolver,
		build: (stubs) => ({
			controller: new OrderExchangeController(stubs.orderExchange) as Row,
			resolver: new OrderExchangeResolver(stubs.orderExchange, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'deleteOrderExchange',
		route: 'delete',
		resource: 'OrderExchange',
		expects: 'deleteOrderExchange',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		member: 'id',
		answersId: true,
		declared: [['id', 'ID']],
		answers: 'DeleteOrderExchangePayload',
		grant: ReturnsPermissions.EXCHANGES_CREATE,
		method: 'delete',
		service: 'orderExchange',
		controller: OrderExchangeController,
		resolver: OrderExchangeResolver,
		build: (stubs) => ({
			controller: new OrderExchangeController(stubs.orderExchange) as Row,
			resolver: new OrderExchangeResolver(stubs.orderExchange, stubs.foreign, stubs.foreign) as Row
		})
	}
];

/**
 * The thirteen routes the reading collapsed, each with the fields that already serve it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is: the
 * audit's expectation for each is asserted absent below — and, for the verb-shaped rows, absent as a
 * substring of every field's name beside the first five letters of the resource, which is the test the
 * instrument itself applies — so this table fails if a future wave renames a serving field out from
 * under the routes that name it in their own docstrings.
 */
const SERVED_ELSEWHERE: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The audit's expectation: a name for a CRUD handler, and the verb itself for a domain one. */
	expects: string;
	/** Whether the audit looks for the verb anywhere in a field's name rather than for the name itself. */
	verb: boolean;
	/** Which of the two shapes this collapse is. */
	kind: 'naming' | 'child';
	/** The fields that answer the capability, at least one of which must be declared. */
	served: string[];
}[] = [
	// The request verbs. The route is named `create` by the controller and `Request a return for an order`
	// by `06` §7.14, and `17` §3.2 row 27 gives the field the second name: `requestOrderReturn`. The
	// audit's expectation `createOrderReturn` matches no field and none is wanted — the field is named for
	// what the act is, and a second field that also created a return would be two doors to one capability.
	{ controller: OrderReturnController, resource: 'OrderReturn', route: 'create', expects: 'createOrderReturn', verb: false, kind: 'naming', served: ['requestOrderReturn'] },
	{ controller: OrderClaimController, resource: 'OrderClaim', route: 'create', expects: 'createOrderClaim', verb: false, kind: 'naming', served: ['requestOrderClaim'] },
	{ controller: OrderExchangeController, resource: 'OrderExchange', route: 'create', expects: 'createOrderExchange', verb: false, kind: 'naming', served: ['requestOrderExchange'] },
	// The reason's reactivation is not `activate` but a one-field write: the handler reaches
	// `orderReturnReasonService.update(id, { isActive: entity.isActive ?? true })` and
	// `updateOrderReturnReason` states the claim only GraphQL has — an input whose `isActive` member is the
	// same write, with the same validation and the same parent check. The audit's glob `*activate*` matches
	// no field, and the capability is answered.
	{ controller: OrderReturnReasonController, resource: 'OrderReturnReason', route: 'activate', expects: 'activate', verb: true, kind: 'naming', served: ['updateOrderReturnReason'] },

	// The three line resources. `05` §3 classes each as "Child owned by an aggregate ("part-of") … the
	// child cannot exist without its parent", and their tables cascade from the aggregate, so neither the
	// API catalogue nor the coverage table ever lists them as REST resources: `06` §7.14's resource set is
	// the four aggregates, and `17` §3.2 row 27 gives each of the three only the recoverable pair. Their
	// rows are written as a set by the parent's own fields — the create by the request the parent's own
	// field takes, the edit by the parent's line-set replace — and the removal the design exposes is the
	// pair the resource serves.
	//
	// A return line.
	{ controller: OrderReturnLineController, resource: 'OrderReturnLine', route: 'create', expects: 'createOrderReturnLine', verb: false, kind: 'child', served: ['requestOrderReturn'] },
	{ controller: OrderReturnLineController, resource: 'OrderReturnLine', route: 'update', expects: 'updateOrderReturnLine', verb: false, kind: 'child', served: ['updateOrderReturn'] },
	{ controller: OrderReturnLineController, resource: 'OrderReturnLine', route: 'delete', expects: 'deleteOrderReturnLine', verb: false, kind: 'child', served: ['updateOrderReturn', 'softDeleteOrderReturnLine'] },
	// A claim line.
	{ controller: OrderClaimLineController, resource: 'OrderClaimLine', route: 'create', expects: 'createOrderClaimLine', verb: false, kind: 'child', served: ['requestOrderClaim'] },
	{ controller: OrderClaimLineController, resource: 'OrderClaimLine', route: 'update', expects: 'updateOrderClaimLine', verb: false, kind: 'child', served: ['updateOrderClaim'] },
	{ controller: OrderClaimLineController, resource: 'OrderClaimLine', route: 'delete', expects: 'deleteOrderClaimLine', verb: false, kind: 'child', served: ['updateOrderClaim', 'softDeleteOrderClaimLine'] },
	// An exchange line.
	{ controller: OrderExchangeLineController, resource: 'OrderExchangeLine', route: 'create', expects: 'createOrderExchangeLine', verb: false, kind: 'child', served: ['requestOrderExchange'] },
	{ controller: OrderExchangeLineController, resource: 'OrderExchangeLine', route: 'update', expects: 'updateOrderExchangeLine', verb: false, kind: 'child', served: ['updateOrderExchange'] },
	{ controller: OrderExchangeLineController, resource: 'OrderExchangeLine', route: 'delete', expects: 'deleteOrderExchangeLine', verb: false, kind: 'child', served: ['updateOrderExchange', 'softDeleteOrderExchangeLine'] }
];

/**
 * The two routes the specifications refuse to mirror.
 *
 * Neither was flagged by the name-based audit — both were counted as answered by `closeOrderReturn`,
 * which is a field of a different resource — and neither may be delivered. `10-orders-payments-and-
 * returns-spec.md` §12.6 is the rule: "`CLAIM_RESOLVE` and `EXCHANGE_RESOLVE` are the only writers of
 * claim and exchange state; both are durable operations with the standard step/compensate contract, and
 * both end by recomputing order totals, `paymentStatus` and `fulfillmentStatus` and emitting
 * `order_claim.approved` or `order_exchange.approved`." §12.1 and §12.2 give `CLOSED` to those
 * operations alone — "APPROVED --> CLOSED : CLAIM_RESOLVE applied" and "APPROVED --> CLOSED :
 * EXCHANGE_RESOLVE applied and difference settled" — and `06` §7.14 declares no close route for either
 * resource. A field mirroring the controller's route would be a second writer of state the design gives
 * one, and the state it would write is the one that says the money settled.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** The fields that reach what the route was for: the resolution that closes the row. */
	served: string[];
}[] = [
	{
		controller: OrderClaimController,
		resource: 'OrderClaim',
		route: 'close',
		expects: 'closeOrderClaim',
		served: ['approveOrderClaim', 'rejectOrderClaim', 'cancelOrderClaim']
	},
	{
		controller: OrderExchangeController,
		resource: 'OrderExchange',
		route: 'close',
		expects: 'closeOrderExchange',
		served: ['approveOrderExchange', 'rejectOrderExchange', 'cancelOrderExchange']
	}
];

/**
 * The counts the reading turns on, stated so the arithmetic below is a test rather than a sentence.
 *
 * `FLAGGED` is what the name-based instrument reported, `RECOVERED` is what the four cross-resource
 * matches it reported as answered turned out to be, and the two sum to the twenty-six the three tables
 * above classify.
 */
const FLAGGED = 22;
const RECOVERED = 4;

/** The members a DTO carries in addition to the route's own body, or lacks from it, and why. */
const VERSION_MEMBER = 'version';

/**
 * The members a DTO validates, its own and the ones it inherits.
 *
 * The wholesale read, needed because a `PartialType` returns a class the declared DTO only *extends*, so
 * the metadata it copied carries the returned class as its target and an own-target read of the declared
 * one would find nothing at all.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function allDtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * One collaborator stub, answering the row it is given with every method the eleven fields could reach.
 *
 * @param answer What the stub answers with.
 * @returns The stub.
 */
function collaborator(answer: unknown): Row {
	return Object.fromEntries(CAPABILITY_METHODS.map((method) => [method, jest.fn().mockResolvedValue(answer)]));
}

/**
 * Both surfaces over the stubs that own them.
 *
 * One stub per capability, and every other collaborator is a stub of its own answering a *different* row,
 * so a field wired to the wrong service is caught by the identity assertion rather than hidden behind a
 * shared double.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		orderReturn: {
			...collaborator(FOREIGN),
			applyVersionedUpdate: jest.fn().mockResolvedValue(RETURN),
			replaceLines: jest.fn().mockResolvedValue(LINES),
			findOneDetailed: jest.fn().mockResolvedValue(RETURN),
			refund: jest.fn().mockResolvedValue(REFUNDED),
			createShipment: jest.fn().mockResolvedValue(LEG),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		orderClaim: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(CLAIM),
			replaceLines: jest.fn().mockResolvedValue(LINES),
			findOneDetailed: jest.fn().mockResolvedValue(CLAIM),
			cancel: jest.fn().mockResolvedValue(CLAIM),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		orderExchange: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(EXCHANGE),
			replaceLines: jest.fn().mockResolvedValue(LINES),
			findOneDetailed: jest.fn().mockResolvedValue(EXCHANGE),
			cancel: jest.fn().mockResolvedValue(EXCHANGE),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		orderReturnReason: {
			...collaborator(FOREIGN),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		// Everything else a resolver injects: a field that reached one of them would answer the foreign row.
		foreign: collaborator(FOREIGN)
	};

	const { controller, resolver } = entry.build(stubs);

	return { stubs, controller, resolver };
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
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
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

/** Every root mutation field's name, in the order the document states them. */
function mutationNames(): string[] {
	return mutationFields().map((field) => field.name.value);
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationNames().includes(name);
}

/**
 * Whether the audit's own test holds for a domain verb: a field whose name carries the verb *and* the
 * first five letters of the resource.
 *
 * Reproduced rather than described, because a row that says "the audit looked for this and there is no
 * such field" is only worth reading if the test applies the instrument's rule.
 *
 * @param verb The route's handler name.
 * @param resource The controller's resource name.
 * @returns True when some field would satisfy the instrument.
 */
function auditHoldsForVerb(verb: string, resource: string): boolean {
	const stem = resource.slice(0, 5).toLowerCase();

	return mutationNames().some(
		(name) => name.toLowerCase().includes(verb.toLowerCase()) && name.toLowerCase().includes(stem)
	);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the returns document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One input type, as the document spells it. */
function inputType(name: string): InputObjectTypeDefinitionNode {
	const input = schemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (!input) {
		throw new Error(`the returns document declares no input named "${name}"`);
	}

	return input;
}

/** The members an input type declares, in the order the document states them. */
function inputMembers(name: string): string[] {
	return (inputType(name).fields ?? []).map((field) => field.name.value);
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/**
 * The schema's half of the eleven fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the returns document — the eleven routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
			}
		}
	});

	it('requires the identifier and the input every write cannot be made without', () => {
		// A write that names no row is not a write, so the identifier is non-null on all eleven — and an
		// input is non-null wherever the route's body is, because a call that states nothing has nothing to
		// write. The one nullable second argument is the cancel's `reason`, which the route's own body
		// declares optional and the service keeps as the row's existing reason when it is absent.
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? [])[0].type.kind).toBe('NonNullType');
		}

		for (const { field, declared } of PARITY) {
			if (declared.length < 2) {
				continue;
			}

			const expected = declared[1][1] === 'String' ? 'NamedType' : 'NonNullType';

			expect({ field, kind: (mutationField(field).arguments ?? [])[1].type.kind }).toEqual({
				field,
				kind: expected
			});
		}
	});

	it('answers the payload each resource’s other mutations answer', () => {
		for (const { field, answers } of PARITY) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('declares the members the route’s own body carries, and only those', () => {
		// Read from the DTO each route validates its body with rather than restated here, so a member added
		// to a DTO and not to the input fails this. The three versioned routes are the only ones whose input
		// carries a member the DTO does not, and it is the one the route reads from a header instead of a
		// body: `If-Match` has no GraphQL counterpart, so the version is stated in the input — which is
		// exactly what `ReceiveOrderReturnInput` already does for the receipt.
		const returnBody = allDtoMembers(EditOrderReturnDTO);
		const claimBody = allDtoMembers(EditOrderClaimDTO);
		const exchangeBody = allDtoMembers(EditOrderExchangeDTO);
		const refundBody = allDtoMembers(RefundOrderReturnDTO);
		const shipBody = allDtoMembers(ShipOrderReturnDTO);

		// The control, so the comparisons below cannot pass on empty readings.
		expect(returnBody).toEqual(['lines', 'note', 'reason', 'warehouseId']);
		expect(claimBody).toEqual(['lines', 'note', 'reason']);
		expect(exchangeBody).toEqual(['allowBackorder', 'lines', 'note']);
		expect(refundBody).toEqual(['amount', 'note', 'reasonId']);
		expect(shipBody).toEqual(['shippingOptionId', 'trackingNumber', 'warehouseId']);

		expect(inputMembers('UpdateOrderReturnInput').sort()).toEqual(
			[...returnBody, VERSION_MEMBER].sort()
		);
		expect(inputMembers('RefundOrderReturnInput').sort()).toEqual([...refundBody, VERSION_MEMBER].sort());
		expect(inputMembers('ShipOrderReturnInput').sort()).toEqual([...shipBody, VERSION_MEMBER].sort());

		// The two resources with no version column state no version member either: `order_claim` and
		// `order_exchange` carry none, no route for them carries `@Versioned`, and a member invented here
		// would be one the kernel had nothing to compare.
		expect(inputMembers('UpdateOrderClaimInput').sort()).toEqual(claimBody);
		expect(inputMembers('UpdateOrderExchangeInput').sort()).toEqual(exchangeBody);
	});

	it('requires the members each route’s own body requires, and leaves the rest optional', () => {
		// An edit states what changed rather than restating the row, so every member of the three update
		// inputs is optional; a refund that states no amount has nothing to pay back, and a replacement line
		// that names no variant is not a replacement — so those are required here as they are on the routes.
		for (const input of ['UpdateOrderReturnInput', 'UpdateOrderClaimInput', 'UpdateOrderExchangeInput']) {
			for (const member of inputMembers(input)) {
				if (member === VERSION_MEMBER) {
					continue;
				}

				// The line set is a list wherever it is declared; every other member of an edit is a scalar
				// the caller states or leaves out.
				const expected = member === 'lines' ? 'ListType' : 'NamedType';

				expect({ input, member, kind: memberKind(input, member) }).toEqual({ input, member, kind: expected });
			}
		}

		expect(memberKind('RefundOrderReturnInput', 'amount')).toBe('NonNullType');
		expect(memberKind('ShipOrderReturnInput', 'shippingOptionId')).toBe('NamedType');
		// The version is nullable everywhere, as the receipt's is: the refusal is the kernel's to state, and
		// a document that made it non-null would refuse the request before the kernel could answer it.
		for (const input of ['UpdateOrderReturnInput', 'RefundOrderReturnInput', 'ShipOrderReturnInput']) {
			expect({ input, kind: memberKind(input, VERSION_MEMBER) }).toEqual({ input, kind: 'NamedType' });
		}
	});

	it('declares every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
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
			'rejectOrderExchange',
			'softDeleteOrderReturn',
			'recoverOrderReturn',
			'softDeleteOrderReturnLine',
			'recoverOrderReturnLine',
			'softDeleteOrderReturnReason',
			'recoverOrderReturnReason',
			'softDeleteOrderClaim',
			'recoverOrderClaim',
			'softDeleteOrderClaimLine',
			'recoverOrderClaimLine',
			'softDeleteOrderExchange',
			'recoverOrderExchange',
			'softDeleteOrderExchangeLine',
			'recoverOrderExchangeLine'
		]) {
			expect(declares(name)).toBe(true);
		}
	});

	it('declares no root field twice, which no assertion inside a document can see', () => {
		// The `gql` tag parses a document with two fields of one name and `buildASTSchema` then fails with
		// `Field "Mutation.x" can only be defined once` — at boot, not here. A duplicate is therefore
		// asserted rather than left to the composition pass.
		const names = mutationNames();

		expect(new Set(names).size).toBe(names.length);
		expect(names).toHaveLength(40);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on its own stub, not a service method named in this file.
 * Every delegation the route makes is compared, not only the first, because the two writes an edit makes
 * are what keep the line set and the version in step.
 */
describe('the eleven fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on the
		// wrong aggregate, and the payload would carry whatever that one returned.
		for (const [name, stub] of Object.entries(stubs)) {
			if (name === entry.service) {
				continue;
			}

			expect(stub[entry.method]).not.toHaveBeenCalled();
		}

		// One answer, one implementation. The three destructive removals and the physical removal answer an
		// identifier, because the row the route's own answer described no longer exists.
		if (entry.answersId) {
			expect(overGraphql[entry.member]).toBe(ID);
			expect(overGraphql.userErrors).toEqual([]);

			return;
		}

		const answer = entry.routeMember ? overRest[entry.routeMember] : overRest;

		expect(overGraphql[entry.member]).toBe(answer);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it.each(PARITY.filter((entry) => entry.alsoCalls.length > 0))(
		'$field makes every further delegation the $route route makes',
		async (entry) => {
			// The edit is two writes and the two refund-shaped routes read the row back, and each of those is
			// a delegation the field has to make as well: a field that replaced the line set but never
			// committed the header would leave the version behind the aggregate it changed, which is the
			// stale-tag hole the route's own comment exists to close.
			const { stubs, controller, resolver } = surfaces(entry);

			await controller[entry.route](...entry.routeArgs);
			await resolver[entry.field](...entry.fieldArgs);

			for (const [method, args] of entry.alsoCalls) {
				expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(1, ...args);
				expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(2, ...args);
				expect(stubs[entry.service][method]).toHaveBeenCalledTimes(2);
			}
		}
	);

	it('answers the refund and the return leg with what the route answered', async () => {
		// The two routes answer a shape of their own rather than the resource: the refund is a payment row
		// and the leg is a fulfilment. The fields wrap them, so the identifier is compared by identity and
		// the figures beside it are compared here — a field that recomputed an amount instead of carrying
		// the one the provider settled would report a number the payment never recorded.
		//
		// Each field also reads the return back, and each route does not: the payload carries the return as
		// well as the refund, because the return is where the running refund total and the version moved on
		// and a client needs the version its next write has to state. That extra call is a **read** — it
		// cannot make the two surfaces behave differently, which is the axis §3.1 forbids — and it is
		// asserted rather than left implicit, so a future wave that made it a write would fail here.
		const refund = PARITY.find(({ field }) => field === 'refundOrderReturn') as IParity;
		const ship = PARITY.find(({ field }) => field === 'shipOrderReturn') as IParity;

		const refundSurfaces = surfaces(refund);

		const refundRest = await refundSurfaces.controller[refund.route](...refund.routeArgs);
		const refundGraphql = await refundSurfaces.resolver[refund.field](...refund.fieldArgs);

		expect(refundRest).toBe(REFUNDED);
		expect(refundGraphql.refundId).toBe(REFUNDED.refundId);
		expect(refundGraphql.refundAmount).toBe(REFUNDED.amount);
		expect(refundGraphql.currency).toBe(REFUNDED.currency);
		expect(refundGraphql.orderReturn).toBe(RETURN);
		expect(refundSurfaces.stubs.orderReturn.findOneDetailed).toHaveBeenCalledTimes(1);
		expect(refundSurfaces.stubs.orderReturn.findOneDetailed).toHaveBeenCalledWith(ID);

		const shipSurfaces = surfaces(ship);

		const shipRest = await shipSurfaces.controller[ship.route](...ship.routeArgs);
		const shipGraphql = await shipSurfaces.resolver[ship.field](...ship.fieldArgs);

		expect(shipRest).toBe(LEG);
		expect(shipGraphql.fulfillmentId).toBe(LEG.fulfillmentId);
		expect(shipGraphql.trackingNumber).toBe(LEG.trackingNumber);
		expect(shipGraphql.labelUrl).toBe(LEG.labelUrl);
		expect(shipGraphql.orderReturn).toBe(RETURN);
		expect(shipSurfaces.stubs.orderReturn.findOneDetailed).toHaveBeenCalledTimes(1);
		expect(shipSurfaces.stubs.orderReturn.findOneDetailed).toHaveBeenCalledWith(ID);
	});

	it('carries the version the guard accepted into both writes, and never as a column', async () => {
		// The version is the caller's statement about the row's concurrency, and the kernel reads it from
		// the operation's arguments on both surfaces — so one request object produces one expectation. What
		// must not happen is the member reaching the service as part of the patch: the edit's input carries
		// it, and a field that spread the input into `applyVersionedUpdate` would write a `version` column
		// from a value no comparison was made against, which is a silent last-write-wins wearing the
		// convention's clothes.
		const entry = PARITY.find(({ field }) => field === 'updateOrderReturn') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		// The control: both surfaces reached the method, so the two readings below are measurements.
		expect(stubs.orderReturn.applyVersionedUpdate).toHaveBeenCalledTimes(2);

		for (const call of stubs.orderReturn.applyVersionedUpdate.mock.calls) {
			expect(call[1]).toEqual({ warehouseId: WAREHOUSE, reason: NOTE, note: NOTE });
			expect(call[1]).not.toHaveProperty(VERSION_MEMBER);
			expect(call[2]).toBe(ACCEPTED);
		}

		// The shipment's options object is the other place an input could leak a member the body has not:
		// `createShipment` takes its options as one object, and a spread would hand it the version.
		const ship = PARITY.find(({ field }) => field === 'shipOrderReturn') as IParity;
		const shipSurfaces = surfaces(ship);

		await shipSurfaces.controller[ship.route](...ship.routeArgs);
		await shipSurfaces.resolver[ship.field](...ship.fieldArgs);

		for (const call of shipSurfaces.stubs.orderReturn.createShipment.mock.calls) {
			expect(call[1]).toEqual({ shippingOptionId: OPTION, warehouseId: WAREHOUSE, trackingNumber: TRACKING });
			expect(call[1]).not.toHaveProperty(VERSION_MEMBER);
			expect(call[2]).toBe(ACCEPTED);
		}
	});

	it('answers the refusal in userErrors rather than as a GraphQL error', async () => {
		// Every mutation of this plugin reports a refusal in the payload, so a client reads one shape for
		// both outcomes. A field that let the service's exception escape would answer a transport error
		// where its siblings answer a payload — and the REST route answers the same refusal as an HTTP
		// status with the platform's code, which the payload carries through `toUserError`.
		for (const { field, fieldArgs, service, method, build } of PARITY) {
			const stubs: Row = {
				orderReturn: collaborator(FOREIGN),
				orderClaim: collaborator(FOREIGN),
				orderExchange: collaborator(FOREIGN),
				orderReturnReason: collaborator(FOREIGN),
				foreign: collaborator(FOREIGN)
			};

			stubs[service][method] = jest.fn().mockRejectedValue(new Error(`${field} refused`));

			const { resolver } = build(stubs);
			const answer = await resolver[field](...fieldArgs);

			expect(answer.userErrors).toHaveLength(1);
			expect(answer.userErrors[0].message).toBe(`${field} refused`);
		}
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the eleven is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could
 * rewrite a return's line set, refund money against a received return, raise a shipment, cancel a claim
 * another operator is deciding, or remove a return outright. All four resolvers state the *view* grant at
 * class level, which is why the comparison is against the route's own handler metadata and not the class.
 */
describe('the eleven fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply: every
			// resolver of this plugin states a class-level *view* grant that must not stand in for the
			// field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('states the five grants the eleven routes state, and never a view grant', () => {
		expect(new Set(PARITY.map(({ grant }) => grant))).toEqual(
			new Set([
				ReturnsPermissions.RETURNS_CREATE,
				ReturnsPermissions.RETURNS_RECEIVE,
				ReturnsPermissions.CLAIMS_CREATE,
				ReturnsPermissions.EXCHANGES_CREATE
			])
		);

		const views = [
			ReturnsPermissions.RETURNS_VIEW,
			ReturnsPermissions.CLAIMS_VIEW,
			ReturnsPermissions.EXCHANGES_VIEW
		];

		for (const { grant } of PARITY) {
			expect(views).not.toContain(grant);
		}
	});

	it('mirrors the route’s version expectation, and invents neither a version nor a retry scope', () => {
		// Three of the eleven routes carry `@Versioned` — the return's own write, the refund and the shipment,
		// which are the three that change the return a caller holds a version of — and the fields carry the
		// same declaration. The other eight carry none, matching their routes: a version expectation invented
		// here would refuse writes the route accepts, and it would be compared against a claim or an exchange
		// that has no version column to compare.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])
			);
		}

		// The divergence is a measurement, not a claim: §7.14 marks the refund and the shipping route "Yes
		// (Idempotency-Key)" — required for the refund — and no `@Idempotent` stands on either route, so none
		// stands on either field. A scope invented here would replay a GraphQL retry that REST lets through.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
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

	it('declares the version on the three versioned fields, on the handler itself', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// three writes that move the return's own version, and the eight that do not.
		const versioned = PARITY.filter(
			({ field, resolver }) =>
				Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field]) !== undefined
		).map(({ field }) => field);

		expect(versioned.sort()).toEqual(['refundOrderReturn', 'shipOrderReturn', 'updateOrderReturn']);
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the name it looked for
 * is absent from the document, and the field that serves the capability — or the door the capability
 * actually has — is present. A future wave that renames a serving field, or that adds one of these names
 * without meaning to, fails here.
 */
describe('the twenty-six routes — four buckets, none of them left unread', () => {
	it('flags twenty-two, recovers four, collapses thirteen, refuses two and implements eleven', () => {
		expect(FLAGGED).toBe(22);
		expect(RECOVERED).toBe(4);

		expect(SERVED_ELSEWHERE).toHaveLength(13);
		expect(PARITY).toHaveLength(11);
		expect(REFUSED).toHaveLength(2);

		expect(SERVED_ELSEWHERE.length + PARITY.length + REFUSED.length).toBe(FLAGGED + RECOVERED);
		expect(FLAGGED + RECOVERED).toBe(26);
	});

	it('splits the collapsed thirteen into four naming variants and nine child routes', () => {
		// The two shapes collapse for different reasons and a reader has to be able to tell them apart: a
		// naming variant is one capability under the name the specification gives it, and a child route is a
		// row written as a set by its parent.
		expect(SERVED_ELSEWHERE.filter(({ kind }) => kind === 'naming')).toHaveLength(4);
		expect(SERVED_ELSEWHERE.filter(({ kind }) => kind === 'child')).toHaveLength(9);
	});

	it.each(SERVED_ELSEWHERE)('$resource.$route is served by $served', ({ controller, route, expects, verb, served }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the surface
		// rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — either the name it built from the handler and the resource, or,
		// for a domain verb, every field name that carries the verb — while the capability is answered by at
		// least one of the fields the table names.
		if (verb) {
			expect(auditHoldsForVerb(expects, controller.name.replace(/Controller$/, ''))).toBe(false);
		} else {
			expect(declares(expects)).toBe(false);
		}

		expect(served.filter((field) => declares(field)).length).toBeGreaterThan(0);
	});

	it.each(REFUSED)('$resource.$route is refused, and what it was for is answered', ({ controller, route, expects, served }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The name the audit looked for is not declared, and the suite asserts that rather than describing
		// it: a wave that adds one of these writes to the schema has to delete the row that refuses it.
		expect(declares(expects)).toBe(false);

		// What the route was for is reached another way: the resolution that closes the row is a field, and
		// it is the operation the specification names as the state's only writer.
		for (const field of served) {
			expect(declares(field)).toBe(true);
		}
	});

	it('refuses the two closes the specification gives to the resolution operation', () => {
		// The citation is the assertion's reason, so it is repeated where it is applied: §12.6 gives claim
		// and exchange state one writer each, and §12.1 and §12.2 give `CLOSED` to that writer.
		expect(REFUSED.map(({ expects }) => expects).sort()).toEqual(['closeOrderClaim', 'closeOrderExchange']);

		// The resolution fields are the ones that reach it, and they already set `CLOSED`: an approval is
		// `CLAIM_RESOLVE`/`EXCHANGE_RESOLVE` on this surface, so the state is reachable and the second writer
		// is not.
		expect(declares('approveOrderClaim')).toBe(true);
		expect(declares('approveOrderExchange')).toBe(true);
	});

	it('cannot tell the four recovered routes from the two refused ones, which is why the reading was independent', () => {
		// The instrument's own test, applied to the four names it built its false matches from. All four
		// hold — for every one of them the verb is carried by a field of a *different* resource, because
		// `closeOrderReturn` and `cancelOrderReturn` both contain the string `order`, which is the first
		// five letters of all seven resource names. That is the blindness in one assertion: the test cannot
		// distinguish the two cancels, which this wave answers, from the two closes, which it refuses.
		expect(auditHoldsForVerb('cancel', 'OrderClaim')).toBe(true);
		expect(auditHoldsForVerb('cancel', 'OrderExchange')).toBe(true);
		expect(auditHoldsForVerb('close', 'OrderClaim')).toBe(true);
		expect(auditHoldsForVerb('close', 'OrderExchange')).toBe(true);

		// What the instrument cannot see, the surface states: the two cancels are declared and the two
		// closes are not, and the fields that carry the verb for the wrong resource are the return's own.
		expect(declares('cancelOrderClaim')).toBe(true);
		expect(declares('cancelOrderExchange')).toBe(true);
		expect(declares('closeOrderClaim')).toBe(false);
		expect(declares('closeOrderExchange')).toBe(false);
		expect(declares('cancelOrderReturn')).toBe(true);
		expect(declares('closeOrderReturn')).toBe(true);
	});

	it('leaves the instrument flagging exactly the sixteen rows this reading explains', () => {
		// The count a reader will meet by running either instrument after this wave: **fourteen** by the
		// name-based one and **sixteen** by the variant that narrows the stem to the resource's full name,
		// which is thirteen collapsed plus two refused plus one delivered. The odd one out is the shipment:
		// the handler is `shipping` and the field is `shipOrderReturn`, because the act is raising a shipment
		// rather than a shipping and `17` §3.6 records the same choice for the fulfillment domain's label
		// route — "the delivered name says what the operation is". The instrument looks for the handler's own
		// word, so it cannot see it, and that is a naming divergence rather than a gap.
		const unexplained = PARITY.filter(instrumentStillFlags).map(({ field }) => field);

		expect(unexplained).toEqual(['shipOrderReturn']);

		// The arithmetic of the residual, stated so the instruments' reported numbers are derivable here:
		// thirteen collapsed, two refused, one delivered-but-named-differently.
		expect(SERVED_ELSEWHERE.length + REFUSED.length + unexplained.length).toBe(16);

		// The control: the other ten deliveries do clear their own flag, so the residual is a measurement of
		// one row rather than of a table that never matched anything.
		expect(PARITY.length - unexplained.length).toBe(10);
	});
});

/**
 * Whether the audit's own test would still flag a route this wave delivered.
 *
 * The instrument branches on the handler: a CRUD handler is answered by an exact `<verb><Resource>` name
 * and anything else by its verb appearing anywhere in a field's name. Reproduced rather than assumed,
 * because the count below is only worth reading if the test applies the instrument's rule.
 *
 * @param entry The delivered route.
 * @returns True when the instrument would not count it as answered.
 */
function instrumentStillFlags(entry: IParity): boolean {
	return CRUD_HANDLERS.includes(entry.route)
		? declares(entry.expects) === false
		: auditHoldsForVerb(entry.expects, entry.resource) === false;
}

/** The handler names the instrument expects to be answered by an exact `<verb><Resource>` field. */
const CRUD_HANDLERS = ['create', 'update', 'delete', 'softRemove', 'softRecover'];

/** How one member of an input type is declared: `NamedType` for a nullable one, `NonNullType` otherwise. */
function memberKind(input: string, member: string): string {
	const field = (inputType(input).fields ?? []).find((candidate) => candidate.name.value === member);

	if (!field) {
		throw new Error(`the returns document declares no member "${member}" on "${input}"`);
	}

	return field.type.kind;
}
