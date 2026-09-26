/**
 * The write routes of this package that no field answered, and the reading that collapsed or refused the
 * rest.
 *
 * §3.1 requires one mutation per REST write route, including the routes inherited from `CrudController<T>`.
 * A name-based audit reads a route's *handler* name against the root fields a package declares, and both
 * of this programme's instruments — the loose one, which matches a domain verb together with the first
 * five characters of the resource, and the strict one, which requires the resource's full name — flag
 * **fourteen** of this package's thirty-five write routes. On this package they agree row for row, and the
 * reason is structural rather than a coincidence worth reading as corroboration: the loose instrument's
 * binding constraint is that a field contain the handler's verb *contiguously*, and every domain-verb route
 * here fails that test before the prefix length can matter. `markFulfillmentInTransit` does not contain
 * `markintransit`, `assignShippingProfileVariant` does not contain `assignvariants`, and no root field of
 * this document contains any of the seven flagged handler verbs as a substring at all — so the
 * five-character stem, which is the only line the two instruments differ on, never gets to decide
 * anything.
 *
 * The fourteen are four buckets, and every row of all four is asserted rather than described:
 *
 * - **Three genuine gaps**, which this suite is mostly about: the correction of one shipment line, and the
 *   destructive removal of a shipment and of a shipment line. Each is a capability a REST caller had and a
 *   GraphQL caller did not, and each is delivered here with the arguments its route takes, the permission
 *   its route states and the same service call.
 * - **Seven naming variants**, where the capability was already reachable: the shipment's own two transition
 *   verbs and its return-direction create, the two shipping-option reads that REST expresses as POSTs, the
 *   variant attachment's set write, and the profile's default flag. `17-graphql-api-specification.md` §3.6
 *   records the naming doctrine for the first of them — "the delivered name says what the operation is" —
 *   and the option pair is the one case whose door is a **Query**, because the route is a read wearing a
 *   POST.
 * - **Three child-through-parent routes**: the create of a shipment line and the create and destructive
 *   delete of a variant attachment. Every one is a row that cannot exist without its parent — `05` §3
 *   classes `fulfillment_line` and `shipping_profile_variant` as "Child owned by an aggregate" and as a
 *   "Pivot / join row" respectively, both `CASCADE` — and its rows are written as a **set** by the parent's
 *   or its sibling's own field.
 * - **One route refused, on a contest rather than on a citation**: `PUT /shipping-profile-variants/:id`.
 *   It is the one row of this reading that could not be settled by reading the code, and both readings are
 *   recorded below rather than hidden.
 *
 * Three properties are pinned for each of the three deliveries, exactly as the lifecycle pair's suite pins
 * them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the type its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of both controllers is the
 *   *view* grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches** — driven through both
 *   real surfaces over one stub — because two protocols that perform one act differently are two
 *   behaviours waiting to diverge.
 *
 * **Retry declarations are mirrored as silence, not invented.** None of the three routes carries
 * `@Idempotent` and none carries `@Versioned`, and `fulfillment_line` has no version column for an
 * expectation to be compared against, so no field declares either. A scope invented here would replay a
 * GraphQL retry that the REST route lets through, which is a difference in behaviour rather than in
 * transport. `updateFulfillmentLine` makes one **read** the route does not — it answers the row rather
 * than the ORM's update result — and a read cannot make the two surfaces behave differently, which is the
 * axis §3.1 forbids; it is asserted rather than left implicit so that a later wave which made it a write
 * would fail here.
 *
 * **Two divergences between the routes and their serving fields are pinned rather than papered over**,
 * because a field has to be one thing or the other and this programme's rule is that it mirrors the route.
 * The variant attachment's create and destructive delete state `SHIPPING_OPTIONS_CREATE` and
 * `SHIPPING_OPTIONS_DELETE` while their only serving field, `assignShippingProfileVariant`, states
 * `SHIPPING_OPTIONS_EDIT`; and `createFulfillment` carries `@Idempotent({… required: true})` while
 * `POST /fulfillments/returns` — which reaches the same service method — carries none, so a REST caller may
 * retry that create without a key and a GraphQL caller may not. Both are asserted below as measurements, so
 * whoever settles them changes both surfaces together.
 *
 * **A finding recorded here that this package has since acted on, and what it did not close.** `16` ADR-26
 * requires that `paymentStatus` and `fulfillmentStatus` "are recomputed by a single function from the
 * ledgers every time a transaction, fulfillment, return, claim or exchange changes, inside the same
 * transaction as the change". The function existed and was exported — `OrderTotalsService.recompute`
 * (`packages/plugins/order/src/lib/order-totals/order-totals.service.ts`), which derives the status through
 * `deriveFulfillmentStatus` and writes it — and `OrderModule` exports it, and `FulfillmentModule` already
 * imported `OrderModule`; what did not exist was the call, since `recompute` was reached only from
 * `OrderService`, `OrderChangeService`, `OrderController`, `OrderResolver` and `SubscriptionOrderService`,
 * all inside the order package. **The call is delivered**: `FulfillmentService` now injects the single
 * function and calls it after the two transitions that move what the derivation reads — `create` for an
 * outbound shipment and `cancel` — under `FULFILLMENT_COMMITTED`, the reason `recompute` documents for
 * this write and which had no production caller before. The wiring and the reasoning are asserted in
 * `../fulfillment/fulfillment.service.spec.ts` rather than here, because which transitions are worth
 * re-deriving is a fact about the service and not about a root field.
 *
 * One half of ADR-26 remains open and is recorded rather than implied. The re-derivation is a **second
 * write, not part of the first**: no transaction exists on this path to run it inside — neither the
 * service nor the concurrency kernel opens one, and `commitVersionedUpdate` takes a `CrudService` rather
 * than a manager — so closing that clause is a change to `packages/core` and to the order package. The
 * safety net ADR-26 names beside it now exists — `OrderTotalsReconciliationScheduler` re-derives, nightly,
 * every order whose lines moved — which is why a re-derivation that could not run is logged and left to it
 * rather than answered as the failure of a shipment that has already committed.
 *
 * **What the three deliveries write is now also what the order line's counters can follow.** The line's
 * correction and both removals reached the inherited service methods, which moved rows the counters were
 * summed from without giving the counters back. The services now refuse that — a correction may not
 * change a line's shipment, order line or quantity, and neither removal may take a row of a shipment the
 * counters still count — and the refusal is made below both surfaces, so the parity asserted here holds
 * for the refusal as well; it is asserted in the two service suites, and the removals' answers below.
 *
 * **Nothing is doubled here but the services.** The two controllers are the real ones, the resolver is the
 * real one with its own decorators and signature, `CrudController` behind them is the kernel's own, and the
 * document the fields are read out of is the real one. Each resolver collaborator is a stub of its own
 * rather than a copy of the one under test, so a field that reached the wrong service is visible instead of
 * passing on a shared double — which matters here more than usual, because `FulfillmentService` and
 * `FulfillmentLineService` both carry an `update` and a `delete`.
 *
 * `@gauzy/core` is **not** doubled, unlike the two sibling specs of this directory, for the reason
 * `soft-delete.spec.ts` states: this suite reads the permission metadata and the retry metadata the
 * kernel's own decorators write, and a no-op double would leave both surfaces unstated so that every
 * comparison below passed on two `undefined`s. The order package is doubled because the fulfilment service
 * reaches it for a collaborator none of these three fields reads.
 */

jest.mock('@gauzy/plugin-order', () => ({ OrderLineService: class OrderLineService {} }));

import { getMetadataStorage } from 'class-validator';
import { FieldDefinitionNode, InputObjectTypeDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { FulfillmentController } from '../fulfillment/fulfillment.controller';
import { FulfillmentLineController } from '../fulfillment-line/fulfillment-line.controller';
import { ShippingOptionController } from '../shipping-option/shipping-option.controller';
import { ShippingProfileController } from '../shipping-profile/shipping-profile.controller';
import { ShippingProfileVariantController } from '../shipping-profile-variant/shipping-profile-variant.controller';
import { UpdateFulfillmentLineDTO } from '../fulfillment-line/dto';
import { ShippingProfileService } from '../shipping-profile/shipping-profile.service';
import { fulfillmentSchemaExtensions } from './schema-extensions';
import { FulfillmentResolver } from './fulfillment.resolver';
import { ShippingOptionResolver } from './shipping-option.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000014';
const WAREHOUSE = '00000000-0000-4000-8000-000000000012';

/** The two variants the pivot's set field is driven with: one already attached, one not. */
const ATTACHED_VARIANT = '00000000-0000-4000-8000-000000000016';
const NEW_VARIANT = '00000000-0000-4000-8000-000000000017';

/**
 * The body the line's own edit route validates, stated in full.
 *
 * Every member of the DTO is stated rather than left absent, because the two handlers could derive what
 * they write differently — the route destructures the body it was handed and the field passes the input it
 * names — and a member left out of one object would make the comparison depend on how each treats an
 * absent key rather than on what either of them writes. `metadata` is the member this wave exists to make
 * reachable: `FulfillmentLineInput`, which the parent's create takes, carries no such member, so the column
 * was writable over neither protocol's GraphQL half until this field.
 */
const LINE_EDIT = {
	orderLineId: ORDER_LINE,
	quantity: '3.000000',
	warehouseId: WAREHOUSE,
	metadata: { bin: 'A-12-3', shortReason: null }
};

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that corrects a line over GraphQL and one that
 * corrects it over REST must be looking at the same record afterwards.
 */
const LINE = { id: ID, orderLineId: ORDER_LINE, quantity: '3.000000' };
const SHIPMENT = { id: ID, orderId: '00000000-0000-4000-8000-000000000020', status: 'PENDING' };

/** What the ORM's own removal reports, which is what both destructive routes answer with. */
const REMOVED = { affected: 1, raw: [] };

/**
 * What a collaborator other than the resource's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/**
 * The methods either service could be asked for by one of these three fields or its route.
 *
 * A collaborator is only useful as a negative control if it *could* have answered the call: a stub without
 * the method would make "no other service was touched" pass on an absence rather than on a measurement.
 * Both of these services really do carry an `update` and a `delete`, which is what makes the control
 * meaningful for a line's correction and for both removals.
 */
const CAPABILITY_METHODS = [
	'update',
	'delete',
	'findOneByIdString',
	'create',
	'findAll',
	'softRemove',
	'softRecover'
];

/** Which of the two injected services owns the capability under test. */
type ServiceKey = 'fulfillment' | 'line';

/**
 * One of the three routes this wave delivers, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for, which is what a client cannot select when it is absent. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces, for the method below. */
	serviceArgs: any[];
	/** The reads the field makes that the route does not, asserted so a later write would fail here. */
	alsoReads: [string, any[]][];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** Whether the field answers a boolean rather than a row, which is what a removal has left to say. */
	answersBoolean?: boolean;
	/** The grant the route's own handler states. */
	grant: PermissionsEnum;
	/** The method both surfaces must reach, checked by the assertions below. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The three routes no field answered.
 *
 * Each is a capability rather than a spare route: correcting a line that was recorded wrong or recording
 * what was picked into it, and the two destructive removals the framework's base controller serves. None of
 * them was reachable, because the fields that existed created rows, moved a status, retired a row
 * recoverably or read one back, and none of them wrote what these write.
 */
const PARITY: IParity[] = [
	{
		field: 'updateFulfillmentLine',
		route: 'update',
		resource: 'FulfillmentLine',
		expects: 'updateFulfillmentLine',
		routeArgs: [ID, LINE_EDIT],
		fieldArgs: [ID, LINE_EDIT],
		serviceArgs: [ID, LINE_EDIT],
		// The write is the route's; the read that follows is the field's, because the route answers whatever
		// the ORM's update returned and a root field has to answer the row.
		alsoReads: [['findOneByIdString', [ID]]],
		declared: [
			['id', 'ID'],
			['input', 'UpdateFulfillmentLineInput']
		],
		answers: 'FulfillmentLine',
		grant: FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT,
		method: 'update',
		service: 'line',
		controller: FulfillmentLineController,
		resolver: FulfillmentResolver
	},
	{
		field: 'deleteFulfillmentLine',
		route: 'delete',
		resource: 'FulfillmentLine',
		expects: 'deleteFulfillmentLine',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoReads: [],
		declared: [['id', 'ID']],
		answers: 'Boolean',
		answersBoolean: true,
		grant: FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT,
		method: 'delete',
		service: 'line',
		controller: FulfillmentLineController,
		resolver: FulfillmentResolver
	},
	{
		field: 'deleteFulfillment',
		route: 'delete',
		resource: 'Fulfillment',
		expects: 'deleteFulfillment',
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoReads: [],
		declared: [['id', 'ID']],
		answers: 'Boolean',
		answersBoolean: true,
		grant: FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT,
		method: 'delete',
		service: 'fulfillment',
		controller: FulfillmentController,
		resolver: FulfillmentResolver
	}
];

/**
 * The routes the audit flags and this wave does not implement, because the capability is already reachable.
 *
 * Two shapes collapse for different reasons and a reader has to be able to tell them apart: a naming variant
 * is one capability under the name the delivery gives it, and a child route is a row written as a set by its
 * parent or its sibling.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** Whether the audit's expectation is the handler's verb rather than a built `<verb><Resource>` name. */
	verb: boolean;
	/** Which of the two shapes this collapse is. */
	kind: 'naming' | 'child';
	/** The root fields that answer the capability, and which root type each one lives on. */
	served: { root: 'Mutation' | 'Query'; field: string }[];
}[] = [
	// The shipment's own transitions. `17` §3.6 records the doctrine beside the label route: the field names
	// what the operation is rather than restating the handler, and `markFulfillmentInTransit` and
	// `requestFulfillmentLabel` are the same act under the name a client reads.
	{
		controller: FulfillmentController,
		resource: 'Fulfillment',
		route: 'markInTransit',
		expects: 'markInTransit',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Mutation', field: 'markFulfillmentInTransit' }]
	},
	{
		controller: FulfillmentController,
		resource: 'Fulfillment',
		route: 'requestLabel',
		expects: 'requestLabel',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Mutation', field: 'requestFulfillmentLabel' }]
	},
	// The return direction is a member of the create rather than a route of its own on this surface: the
	// route reaches `create` with `direction: RETURN` appended, and `CreateFulfillmentInput` declares a
	// `direction` member that reaches the same service call with the same effect. The trap this row exists to
	// record is that the service also carries a `createReturnLeg`, which this route does **not** call.
	{
		controller: FulfillmentController,
		resource: 'Fulfillment',
		route: 'createReturn',
		expects: 'createReturn',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Mutation', field: 'createFulfillment' }]
	},
	// The two shipping-option reads REST expresses as POSTs, and the reason their door is a Query rather than
	// a mutation: the controller's own header says "`eligible` and `calculate` are deliberately not
	// decorated: they are reads expressed as POSTs, and a key on a read cannot duplicate anything." §3.1
	// makes reads queries, so a mutation mirroring either route would be the wrong shape for the capability.
	{
		controller: ShippingOptionController,
		resource: 'ShippingOption',
		route: 'eligible',
		expects: 'eligible',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Query', field: 'shippingOptionsForContext' }]
	},
	{
		controller: ShippingOptionController,
		resource: 'ShippingOption',
		route: 'calculate',
		expects: 'calculate',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Query', field: 'shippingRate' }]
	},
	// The variant attachment's set write, which is the profile's own route because the rule that keeps a
	// variant in one profile lives there.
	{
		controller: ShippingProfileController,
		resource: 'ShippingProfile',
		route: 'assignVariants',
		expects: 'assignVariants',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Mutation', field: 'assignShippingProfileVariant' }]
	},
	// The default flag is a one-member write through the profile's own edit: the route calls
	// `shippingProfileService.update(id, { isDefault: true })` and so does the field, whose input declares
	// `isDefault` and whose service enforces the one-default rule inside `update` rather than in the route.
	{
		controller: ShippingProfileController,
		resource: 'ShippingProfile',
		route: 'setDefault',
		expects: 'setDefault',
		verb: true,
		kind: 'naming',
		served: [{ root: 'Mutation', field: 'updateShippingProfile' }]
	},

	// A shipment line is written as part of its shipment: `createFulfillment` reaches
	// `FulfillmentService.create`, which writes each line through the very `FulfillmentLineService.create`
	// the route calls, with the parent's identifier stamped on. The controller's own header says as much —
	// "A line is normally written as part of its fulfilment, which is why the two write routes below carry
	// the fulfilment grants: they are the repair surface for a line recorded on its own."
	{
		controller: FulfillmentLineController,
		resource: 'FulfillmentLine',
		route: 'create',
		expects: 'createFulfillmentLine',
		verb: false,
		kind: 'child',
		served: [{ root: 'Mutation', field: 'createFulfillment' }]
	},
	// The variant attachment is a pivot, and its create and destructive delete are the sibling's set field:
	// `assignShippingProfileVariant` reaches `ShippingProfileService.assignVariants`, which calls
	// `pivotService.create({ profileId, variantId })` to attach and `pivotService.delete(attachment.id)` to
	// detach — the same service methods the two routes call, and the same hard delete for the removal.
	{
		controller: ShippingProfileVariantController,
		resource: 'ShippingProfileVariant',
		route: 'create',
		expects: 'createShippingProfileVariant',
		verb: false,
		kind: 'child',
		served: [{ root: 'Mutation', field: 'assignShippingProfileVariant' }]
	},
	{
		controller: ShippingProfileVariantController,
		resource: 'ShippingProfileVariant',
		route: 'delete',
		expects: 'deleteShippingProfileVariant',
		verb: false,
		kind: 'child',
		served: [{ root: 'Mutation', field: 'assignShippingProfileVariant' }]
	}
];

/**
 * The one route refused, and both readings of it.
 *
 * The route is real, the resource is real and the capability is at least partly reachable — which is exactly
 * why this row could not be settled by reading the code, and why it was refused rather than delivered.
 */
const CONTESTED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** The field an owner ruling the other way would get. */
	field: string;
	/** The set field that answers part of the capability. */
	servedBy: string;
	readings: { bucket: 1 | 3; why: string }[];
}[] = [
	{
		controller: ShippingProfileVariantController,
		resource: 'ShippingProfileVariant',
		route: 'update',
		expects: 'updateShippingProfileVariant',
		field: 'updateShippingProfileVariant',
		servedBy: 'assignShippingProfileVariant',
		readings: [
			{
				bucket: 1,
				why: 'The set field reaches the pivot service’s create and delete and never its update, so the method this route calls is reached by nothing: a move is expressible only as a delete followed by a create, the row’s identifier changes under the caller, and `metadata` is unwritable over this surface by any route.'
			},
			{
				bucket: 3,
				why: '`05` §13.2 declares this table’s columns as exactly `profileId` and `variantId` and gives it no `metadata` column, so the delivered member is code-beyond-spec and the only thing a pivot row can be asked to say is which pair it joins — which `assignShippingProfileVariant` already says.'
			}
		]
	}
];

/**
 * The counts the reading turns on, stated so the arithmetic below is a test rather than a sentence.
 *
 * `FLAGGED` is what both instruments reported on this package — identical row for row — and the fourteen
 * split into the three this wave delivers, the ten whose capability was already reachable, and the one it
 * refuses.
 */
const FLAGGED = 14;
const DELIVERED = PARITY.length;
const REACHABLE = COLLAPSED.length;
const REFUSED = CONTESTED.length;

/** The members a DTO carries that no input of this document states, because tenancy is never the caller's. */
const TENANCY_MEMBERS = ['organization', 'organizationId', 'sentTo', 'tenant', 'tenantId'];

/**
 * The members the line's own edit route validates, read from the DTO rather than restated.
 *
 * The read walks the prototype chain, because `PartialType` returns a class the declared DTO only
 * *extends*: the metadata it copies carries the returned class as its target, so a read of the declared
 * class alone would find nothing and every comparison below would pass on two empty lists. The tenancy
 * members the chain also validates are subtracted, because no input of this document states them and none
 * may: tenancy is resolved from the caller.
 *
 * @param dto The DTO to read.
 * @returns Every member it validates that is the route's own, sorted.
 */
function dtoMembers(dto: new (...args: any[]) => any): string[] {
	const storage = getMetadataStorage();
	const names = new Set<string>();
	let current: any = dto;

	while (typeof current === 'function' && current !== Function.prototype) {
		for (const entry of storage.getTargetValidationMetadatas(current, '', false, false)) {
			if (!TENANCY_MEMBERS.includes(entry.propertyName)) {
				names.add(entry.propertyName);
			}
		}

		current = Object.getPrototypeOf(current);
	}

	return [...names].sort();
}

/**
 * Both surfaces over the stubs that own them.
 *
 * One stub per service, and the other one is a stub of its own answering a *different* row, so a field
 * wired to the wrong service is caught by the identity assertion rather than hidden behind a shared double.
 * This matters here because both services carry an `update` and a `delete`.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		fulfillment: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(SHIPMENT),
			findOneByIdString: jest.fn().mockResolvedValue(SHIPMENT),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		line: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(LINE),
			findOneByIdString: jest.fn().mockResolvedValue(LINE),
			delete: jest.fn().mockResolvedValue(REMOVED)
		}
	};

	return {
		stubs,
		controller: new entry.controller(stubs[entry.service]) as Row,
		resolver: new FulfillmentResolver(stubs.fulfillment, stubs.line) as Row
	};
}

/**
 * One collaborator stub, answering the row it is given with every method these fields could reach.
 *
 * @param answer What the stub answers with.
 * @returns The stub.
 */
function collaborator(answer: unknown): Row {
	return Object.fromEntries(CAPABILITY_METHODS.map((method) => [method, jest.fn().mockResolvedValue(answer)]));
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of the resolver, as functions. */
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

/** The root fields of one operation type, as the document declares them. */
function rootFields(typeName: 'Mutation' | 'Query'): FieldDefinitionNode[] {
	const root = fulfillmentSchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === typeName
	);

	if (!root?.fields?.length) {
		throw new Error(`the fulfilment document declares no ${typeName} fields`);
	}

	return [...root.fields];
}

/** Every root field name on one operation type, in the order the document states them. */
function rootFieldNames(typeName: 'Mutation' | 'Query'): string[] {
	return rootFields(typeName).map((field) => field.name.value);
}

/** Whether the document declares a root *mutation* field of that name. */
function declares(name: string): boolean {
	return rootFieldNames('Mutation').includes(name);
}

/** One root field, as the document spells it. */
function rootField(typeName: 'Mutation' | 'Query', name: string): FieldDefinitionNode {
	const field = rootFields(typeName).find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the fulfilment document declares no ${typeName} field named "${name}"`);
	}

	return field;
}

/** One input type, as the document spells it. */
function inputType(name: string): InputObjectTypeDefinitionNode {
	const input = fulfillmentSchemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (!input) {
		throw new Error(`the fulfilment document declares no input named "${name}"`);
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
 * Whether the audit's own test would still flag a route, reproduced rather than described.
 *
 * The instrument branches on the handler: a CRUD handler is answered by an exact `<verb><Resource>` name
 * and anything else by its verb appearing anywhere in a field's name. A row that says "the instrument
 * looked for this and there is no such field" is only worth reading if the test applies the instrument's
 * rule.
 *
 * @param entry The route, as the reading classifies it.
 * @returns True when the instrument would not count the route as answered.
 */
function instrumentStillFlags(entry: { resource: string; expects: string; verb: boolean }): boolean {
	return entry.verb
		? auditHoldsForVerb(entry.expects, entry.resource) === false
		: declares(entry.expects) === false;
}

/**
 * Whether the audit's verb test holds: a mutation whose name carries the verb *and* the first five letters
 * of the resource.
 *
 * Read against the mutation block alone, because that is what the instrument reads — which is one of the two
 * ways it is blind here, and the reason the two shipping-option reads below are asserted against the Query
 * block instead.
 *
 * @param verb The route's handler name.
 * @param resource The controller's resource name.
 * @returns True when some mutation would satisfy the instrument.
 */
function auditHoldsForVerb(verb: string, resource: string): boolean {
	const stem = resource.slice(0, 5).toLowerCase();

	return rootFieldNames('Mutation').some(
		(name) => name.toLowerCase().includes(verb.toLowerCase()) && name.toLowerCase().includes(stem)
	);
}

/**
 * The schema's half of the three fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the fulfilment document — the three routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(rootField('Mutation', field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = rootField('Mutation', field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
			}
		}
	});

	it('answers what each route has left to answer with', () => {
		// The correction answers the row, which is what its siblings answer; the two removals answer a
		// boolean, because a row that has been deleted has nothing left to hand back — which is also what
		// `deleteShippingProfile` and `deleteShippingOption` answer.
		for (const { field, answers, answersBoolean } of PARITY) {
			const type = rootField('Mutation', field).type;

			expect(type.kind).toBe('NonNullType');
			expect(namedTypeName(type)).toBe(answers);
			expect({ field, answersBoolean: Boolean(answersBoolean) }).toEqual({
				field,
				answersBoolean: answers === 'Boolean'
			});
		}
	});

	it('requires the identifier every write cannot be made without', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = rootField('Mutation', field).arguments ?? [];

			expect(arguments_[0].name.value).toBe('id');
			expect(arguments_[0].type.kind).toBe('NonNullType');
			expect(namedTypeName(arguments_[0].type)).toBe('ID');

			// An edit that states nothing has nothing to write, so the input is non-null where the route has a
			// body and absent where it has none: the two removals take the identifier alone.
			if (declared.length === 2) {
				expect(arguments_[1].type.kind).toBe('NonNullType');
			} else {
				expect(arguments_).toHaveLength(1);
			}
		}
	});

	it('declares the members the line’s own body carries, and only those', () => {
		// Read from the DTO the route validates its body with rather than restated here, so a member added to
		// the DTO and not to the input fails this, and a member invented in the input fails it too. The control
		// below is what makes the comparison a measurement rather than a comparison of two empty lists.
		const body = dtoMembers(UpdateFulfillmentLineDTO);

		expect(body).toEqual(['fulfillmentId', 'metadata', 'orderLineId', 'quantity', 'warehouseId']);
		expect(inputMembers('UpdateFulfillmentLineInput').sort()).toEqual(body);
	});

	it('declares every optional member as optional, because an edit states what changed', () => {
		// A member of an edit that the document made non-null would refuse a request that states only what it
		// changed, which is what the route accepts.
		for (const member of inputMembers('UpdateFulfillmentLineInput')) {
			const declared = (inputType('UpdateFulfillmentLineInput').fields ?? []).find(
				(candidate) => candidate.name.value === member
			);

			expect({ member, kind: declared?.type.kind }).toEqual({ member, kind: 'NamedType' });
		}
	});

	it('declares every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const field of [
			'createShippingProfile',
			'updateShippingProfile',
			'deleteShippingProfile',
			'softDeleteShippingProfile',
			'recoverShippingProfile',
			'assignShippingProfileVariant',
			'softDeleteShippingProfileVariant',
			'recoverShippingProfileVariant',
			'createShippingOption',
			'updateShippingOption',
			'deleteShippingOption',
			'softDeleteShippingOption',
			'recoverShippingOption',
			'createFulfillment',
			'updateFulfillment',
			'shipFulfillment',
			'markFulfillmentInTransit',
			'deliverFulfillment',
			'cancelFulfillment',
			'requestFulfillmentLabel',
			'softDeleteFulfillment',
			'recoverFulfillment',
			'softDeleteFulfillmentLine',
			'recoverFulfillmentLine'
		]) {
			expect(declares(field)).toBe(true);
		}
	});

	it('declares no root field twice, which no assertion inside a document can see', () => {
		// The `gql` tag parses a document with two fields of one name and `buildASTSchema` then fails with
		// `Field "Mutation.x" can only be defined once` — at boot, not here. A duplicate is therefore asserted
		// rather than left to the composition pass.
		const names = rootFieldNames('Mutation');

		expect(new Set(names).size).toBe(names.length);
		expect(names).toHaveLength(27);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the three fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input are
		// one statement about the row, and a field that reordered them or dropped one would be a different
		// write.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: both of these services carry an `update` and a `delete`, so a field
		// wired to the wrong one is a field that acts on the wrong aggregate — and it would have answered
		// rather than failed, which is what makes this a measurement instead of an absence.
		for (const [name, stub] of Object.entries(stubs)) {
			if (name === entry.service) {
				continue;
			}

			for (const method of CAPABILITY_METHODS) {
				expect({ service: name, method, calls: stub[method].mock.calls.length }).toEqual({
					service: name,
					method,
					calls: 0
				});
			}
		}

		// One answer, one implementation. The two removals answer a boolean, because the row the route's own
		// `DeleteResult` described no longer exists; the correction answers the row.
		if (entry.answersBoolean) {
			expect(overGraphql).toBe(true);
			expect(overRest).toBe(REMOVED);

			return;
		}

		expect(overGraphql).toBe(LINE);
		expect(overRest).toBe(LINE);
	});

	it.each(PARITY.filter((entry) => entry.alsoReads.length > 0))(
		'$field makes the read the route does not, and it is a read',
		async (entry) => {
			// The correction answers the row, and the route answers whatever the ORM's update returned — so the
			// field reads once after writing. That extra call is a **read**: it cannot make the two surfaces
			// behave differently, which is the axis §3.1 forbids, and it is asserted so that a later wave which
			// made it a write would fail here.
			const { stubs, controller, resolver } = surfaces(entry);

			await controller[entry.route](...entry.routeArgs);
			await resolver[entry.field](...entry.fieldArgs);

			for (const [method, args] of entry.alsoReads) {
				// Once, and only from the field: the control is that the route wrote and did not read.
				expect(stubs[entry.service][method]).toHaveBeenCalledTimes(1);
				expect(stubs[entry.service][method]).toHaveBeenCalledWith(...args);
			}
		}
	);

	it('carries the line’s payload member into the write, which is the column no other field could reach', async () => {
		// `FulfillmentLineInput`, which the parent's create takes, declares the order line, the quantity and the
		// warehouse and no payload — so before this field the `metadata` column was writable over neither
		// protocol's GraphQL half. The assertion is that the member arrives, rather than that an object did.
		const entry = PARITY.find(({ field }) => field === 'updateFulfillmentLine') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		// The control: both surfaces reached the method, so the readings below are measurements.
		expect(stubs.line.update).toHaveBeenCalledTimes(2);

		for (const call of stubs.line.update.mock.calls) {
			expect(call[1]).toEqual(LINE_EDIT);
			expect(call[1].metadata).toEqual({ bin: 'A-12-3', shortReason: null });
		}

		// And the parent's own create input still cannot state one, which is what makes this field the door.
		expect(inputMembers('FulfillmentLineInput')).toEqual(['orderLineId', 'quantity', 'warehouseId']);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the three is a write — two of them destructive and irreversible — so a field that stated no grant
 * of its own would be one `PermissionGuard` answers `true` to, because it answers `true` to empty metadata:
 * every authenticated caller could rewrite a shipment's line or remove a shipment outright. Both resolvers
 * state the *view* grant at class level, which is why the comparison is against the route's own handler
 * metadata and not the class.
 */
describe('the three fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');
			expect(typeof fieldsOf(resolver)[field]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the editing grant each route states, on the handler itself', () => {
		// Read from the field's own handler rather than through the override rule the guards apply: both
		// resolvers state a class-level *view* grant that must not stand in for the field's own.
		for (const { field, route, controller, resolver, grant } of PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
			expect(grant).toBe(FULFILLMENT_PERMISSIONS.FULFILLMENTS_EDIT);
			expect(grant).not.toBe(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(FulfillmentController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});

	it('mirrors the routes’ retry silence, and invents neither a scope nor a version', () => {
		// None of the three routes carries `@Idempotent` and none carries `@Versioned`, and `fulfillment_line`
		// has no version column for an expectation to be compared against. A scope invented here would replay a
		// GraphQL retry that the REST route lets through, which is a difference in behaviour rather than in
		// transport.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
		}
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the name it looked for is
 * absent from the document, and the field that serves the capability — or the door the capability actually
 * has — is present. A future wave that renames a serving field, or that adds one of these names without
 * meaning to, fails here.
 */
describe('the fourteen routes — four buckets, none of them left unread', () => {
	it('flags fourteen, collapses ten, refuses one and implements three', () => {
		expect(FLAGGED).toBe(14);
		expect(DELIVERED).toBe(3);
		expect(REACHABLE).toBe(10);
		expect(REFUSED).toBe(1);

		// The arithmetic, as a test: the fourteen are the three this wave delivers plus the ten whose
		// capability was already reachable plus the one it refuses.
		expect(DELIVERED + REACHABLE + REFUSED).toBe(FLAGGED);
	});

	it('splits the collapsed ten into seven naming variants and three child routes', () => {
		// The two shapes collapse for different reasons and a reader has to be able to tell them apart: a
		// naming variant is one capability under the name the delivery gives it, and a child route is a row
		// written as a set by its parent or its sibling.
		expect(COLLAPSED.filter(({ kind }) => kind === 'naming')).toHaveLength(7);
		expect(COLLAPSED.filter(({ kind }) => kind === 'child')).toHaveLength(3);
	});

	it('leaves the instruments flagging exactly the eleven rows this reading explains', () => {
		// The count a reader will meet by running either instrument after this wave: **eleven**, because the
		// three delivered names are exactly the names the instrument builds and so clear their own flags. The
		// two instruments report the same eleven, for the structural reason the header states.
		const residual = [
			...COLLAPSED.map(({ resource, expects, verb }) => instrumentStillFlags({ resource, expects, verb })),
			...CONTESTED.map(({ resource, expects }) => instrumentStillFlags({ resource, expects, verb: false }))
		];

		expect(residual.every(Boolean)).toBe(true);
		expect(residual).toHaveLength(11);

		// And the three deliveries no longer flag: the control that makes the eleven a measurement rather than
		// a table that never matched anything.
		for (const { expects, resource } of PARITY) {
			expect(instrumentStillFlags({ resource, expects, verb: false })).toBe(false);
		}

		// The arithmetic of the residual, stated so the instruments' reported numbers are derivable here.
		expect(REACHABLE + REFUSED).toBe(11);
		expect(FLAGGED - DELIVERED).toBe(11);
	});

	it.each(COLLAPSED)('$resource.$route is served by its own door', ({ controller, route, expects, verb, served }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the surface
		// rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — either the name it built from the handler and the resource or,
		// for a domain verb, every mutation name that carries the verb — while the capability is answered by
		// the fields the table names.
		if (verb) {
			expect(auditHoldsForVerb(expects, controller.name.replace(/Controller$/, ''))).toBe(false);
		} else {
			expect(declares(expects)).toBe(false);
		}

		for (const { root, field } of served) {
			expect(rootField(root, field).name.value).toBe(field);
		}
	});

	it('answers the two shipping-option reads with queries, because §3.1 makes a read a query', () => {
		// The one shape in this reading where the instrument's blindness and the specification point the same
		// way: the routes are POSTs, the capability is a read, and a mutation mirroring either would be the
		// wrong root type. The instrument reads the mutation block alone, so it cannot see either field.
		const eligible = COLLAPSED.find(({ route }) => route === 'eligible') as (typeof COLLAPSED)[number];
		const calculate = COLLAPSED.find(({ route }) => route === 'calculate') as (typeof COLLAPSED)[number];

		expect(eligible.served).toEqual([{ root: 'Query', field: 'shippingOptionsForContext' }]);
		expect(calculate.served).toEqual([{ root: 'Query', field: 'shippingRate' }]);

		// Neither name is a mutation, and neither route's verb is carried by any mutation name beside the first
		// five letters of `ShippingOption`.
		expect(declares('shippingOptionsForContext')).toBe(false);
		expect(declares('shippingRate')).toBe(false);
		expect(auditHoldsForVerb('eligible', 'ShippingOption')).toBe(false);
		expect(auditHoldsForVerb('calculate', 'ShippingOption')).toBe(false);
	});

	it('answers the two option reads with the same service call the routes make', () => {
		// The door is a different root type, so the delegation is asserted the way the three deliveries' is:
		// one stub, both surfaces, the same method with the same arguments.
		const optionService = {
			findEligible: jest.fn().mockResolvedValue([]),
			calculate: jest.fn().mockResolvedValue({ amount: '5.000000' })
		};
		const resolver = new ShippingOptionResolver(optionService as never, {} as never) as Row;
		const controller = new ShippingOptionController(optionService as never) as Row;
		const context = { channelId: ID, totalWeight: '2.000000' };

		void controller.eligible(context);
		void resolver.shippingOptionsForContext(context);

		expect(optionService.findEligible).toHaveBeenNthCalledWith(1, context);
		expect(optionService.findEligible).toHaveBeenNthCalledWith(2, context);
		expect(optionService.findEligible).toHaveBeenCalledTimes(2);

		void controller.calculate({ shippingOptionId: ID, ...context });
		void resolver.shippingRate(ID, context);

		expect(optionService.calculate).toHaveBeenNthCalledWith(1, ID, { shippingOptionId: ID, ...context });
		expect(optionService.calculate).toHaveBeenNthCalledWith(2, ID, context);
		expect(optionService.calculate).toHaveBeenCalledTimes(2);
	});

	it.each(CONTESTED)('$resource.$route is refused, and both readings of it are recorded', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');

		// The name the audit looked for is not declared, and the suite asserts that rather than describing it:
		// a wave that adds this write to the schema has to delete the row that refuses it.
		expect(declares(entry.expects)).toBe(false);
		expect(instrumentStillFlags({ resource: entry.resource, expects: entry.expects, verb: false })).toBe(true);

		// The field an owner ruling the other way would get is named, and it is not declared either.
		expect(declares(entry.field)).toBe(false);

		// Both readings are stated, and they are the two buckets that could claim this row.
		expect(entry.readings.map(({ bucket }) => bucket).sort()).toEqual([1, 3]);
		expect(entry.readings.every(({ why }) => why.length > 0)).toBe(true);

		// What serves part of the capability is declared, which is why the row is a contest and not a plain
		// gap: the set field attaches and detaches the pivot.
		expect(declares(entry.servedBy)).toBe(true);
	});

	it('records why the pivot’s set field cannot settle the contested row: it never updates', async () => {
		// The reading that makes the row a contest rather than a gap is a fact about the service, not about the
		// schema: `assignVariants` reaches `create` and `delete` on the pivot service and never `update`, so
		// the method the refused route calls is reached by no field at all. The real service is driven with only
		// its outermost reads stubbed — its own existence check, and the pivot's reads, which are filtered by the
		// `where` the service hands them so that the attach and detach branches are both genuinely exercised —
		// so the claim is about the real `assignVariants` body rather than about a double of it.
		const attached = [{ id: `${ID}-attachment`, profileId: ID, variantId: ATTACHED_VARIANT }];
		const pivotService = {
			findAll: jest.fn(async (options: Row) => {
				const where = options?.where ?? {};
				const items = attached.filter(
					(attachment) =>
						(where.profileId === undefined || attachment.profileId === where.profileId) &&
						(where.variantId === undefined || attachment.variantId === where.variantId)
				);

				return { items, total: items.length };
			}),
			create: jest.fn().mockResolvedValue(FOREIGN),
			delete: jest.fn().mockResolvedValue(REMOVED),
			update: jest.fn().mockResolvedValue(FOREIGN)
		};
		const service = new ShippingProfileService({} as never, {} as never, pivotService as never);

		// The service's own profile read is the one call that would reach a repository, and it is stubbed
		// because this suite has no database behind it — the assertion below is about the pivot, not about it.
		service.findOneByIdString = jest.fn().mockResolvedValue({ id: ID, isDefault: false } as never);

		// One variant that is already attached and one that is not, so the detach and the attach branches are
		// both taken: a set of two already-attached variants would exercise neither the create nor the delete.
		await service.assignVariants(ID, { add: [NEW_VARIANT], remove: [ATTACHED_VARIANT] });

		// The control: the set field did reach the pivot on both branches, so the `not` below is a measurement
		// rather than an absence.
		expect(pivotService.delete).toHaveBeenCalledWith(`${ID}-attachment`);
		expect(pivotService.create).toHaveBeenCalledWith({ profileId: ID, variantId: NEW_VARIANT });
		expect(pivotService.update).not.toHaveBeenCalled();
	});
});

/**
 * The two divergences this wave records rather than settles.
 *
 * A field has to be one thing or the other, and this programme's rule is that it mirrors the route. These
 * two are pinned as measurements so that whoever settles them changes both surfaces together.
 */
describe('the divergences between the routes and their serving fields', () => {
	it('records the grant the variant attachment’s create and delete state, which its serving field does not', () => {
		// `POST /shipping-profile-variants` states `SHIPPING_OPTIONS_CREATE` and `DELETE
		// /shipping-profile-variants/:id` states `SHIPPING_OPTIONS_DELETE`, while the only field that reaches
		// the pivot service — `assignShippingProfileVariant` — states `SHIPPING_OPTIONS_EDIT`. §13.3 requires
		// "the permission required by a mutation equals the permission required by its REST route", so the
		// capability is reachable under a different grant from the one its own route demands.
		expect(permissionOfRoute(ShippingProfileVariantController, 'create')).toEqual([
			FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE
		]);
		expect(permissionOfRoute(ShippingProfileVariantController, 'delete')).toEqual([
			FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE
		]);
		expect(permissionOfField(ShippingOptionResolver, 'assignShippingProfileVariant')).toEqual([
			FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT
		]);

		expect(permissionOfRoute(ShippingProfileVariantController, 'create')).not.toEqual(
			permissionOfField(ShippingOptionResolver, 'assignShippingProfileVariant')
		);
		expect(permissionOfRoute(ShippingProfileVariantController, 'delete')).not.toEqual(
			permissionOfField(ShippingOptionResolver, 'assignShippingProfileVariant')
		);
	});

	it('records that the return-direction create requires a retry key on one surface and not the other', () => {
		// `POST /fulfillments/returns` reaches `FulfillmentService.create` and carries no `@Idempotent`, while
		// `createFulfillment` — which reaches the same method — requires one. A REST caller may therefore retry
		// that create without a key and a GraphQL caller may not, and §13.3 asks that "the mutations that
		// require `idempotencyKey` equal the REST routes that require `Idempotency-Key`". The control is the
		// other create route, which does require one, so the reading is not "no route is decorated".
		const returnsKey = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(FulfillmentController).createReturn);
		const createKey = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(FulfillmentController).create);
		const fieldKey = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(FulfillmentResolver).createFulfillment);

		expect(returnsKey).toBeUndefined();
		expect(createKey).toMatchObject({ scope: 'fulfillment.create', required: true });
		expect(fieldKey).toMatchObject({ scope: 'fulfillment.create', required: true });
	});
});

/**
 * What a removal answers when it removed nothing, and when it was refused (C10, and the delete-answer
 * finding).
 *
 * The boolean fields used to answer `Boolean(result)`, which is `true` for any `DeleteResult` at all — so an
 * identifier of another tenant, a stale one or one already gone was answered as removed, while the route's
 * own body carried `affected: 0`. They now answer whether a row was removed, which is the rule the order
 * plugin's deletes answer with, and all four boolean removals of this document answer by it.
 */
describe('the removals — a removal that matched nothing is not a success', () => {
	/** What the ORM's removal reports when its scoped statement matched no row. */
	const NOTHING = { affected: 0, raw: [] };

	it.each(PARITY.filter((entry) => entry.answersBoolean))(
		'$field answers false where its route answers affected: 0',
		async (entry) => {
			const { stubs, controller, resolver } = surfaces(entry);

			stubs[entry.service].delete.mockResolvedValue(NOTHING);

			const overRest = await controller[entry.route](...entry.routeArgs);
			const overGraphql = await resolver[entry.field](...entry.fieldArgs);

			// The route passes the result on, so a REST caller reads `affected: 0`; the field says the same
			// thing in its own vocabulary rather than the opposite.
			expect(overRest).toBe(NOTHING);
			expect(overGraphql).toBe(false);
		}
	);

	it('answers the shipping profile and option removals by the same rule', async () => {
		const optionService = { ...collaborator(FOREIGN), delete: jest.fn() };
		const profileService = { ...collaborator(FOREIGN), delete: jest.fn() };
		const resolver = new ShippingOptionResolver(optionService as never, profileService as never) as Row;

		for (const [result, expected] of [
			[REMOVED, true],
			[NOTHING, false],
			[undefined, false]
		] as [unknown, boolean][]) {
			optionService.delete.mockResolvedValueOnce(result);
			profileService.delete.mockResolvedValueOnce(result);

			expect(await resolver.deleteShippingOption(ID)).toBe(expected);
			expect(await resolver.deleteShippingProfile(ID)).toBe(expected);
		}

		// The control: each field reached its own service, so the answers above are about that service's
		// result and not about a shared double.
		expect(optionService.delete).toHaveBeenCalledTimes(3);
		expect(profileService.delete).toHaveBeenCalledTimes(3);
	});

	it.each(PARITY.filter((entry) => entry.answersBoolean))(
		'$field reaches the refusal its route reaches, and answers it as an error rather than as false',
		async (entry) => {
			// A shipment the order line still counts is refused by the service both surfaces reach, so the
			// refusal is one behaviour on both: the route answers it as the HTTP error and the field as the
			// GraphQL one, and neither turns it into a quiet `false`.
			const { stubs, controller, resolver } = surfaces(entry);
			const refusal = new Error(
				entry.service === 'line' ? 'FULFILLMENT_LINE_NOT_DELETABLE: refused' : 'FULFILLMENT_NOT_DELETABLE: refused'
			);

			stubs[entry.service].delete.mockRejectedValue(refusal);

			await expect(controller[entry.route](...entry.routeArgs)).rejects.toBe(refusal);
			await expect(resolver[entry.field](...entry.fieldArgs)).rejects.toBe(refusal);
		}
	);
});
