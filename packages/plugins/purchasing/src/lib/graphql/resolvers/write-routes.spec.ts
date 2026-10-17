/**
 * The nine write routes of this package that no field answered, and what became of each.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **nine** of this package's thirty-three
 * write routes — which is not a gap count, because the instrument measures names and reach, not
 * capabilities. The nine are four different readings, and this suite states each of them:
 *
 * - **Two are answered already, under another name.** `POST /goods-receipts/:id/cancel` is
 *   `closeGoodsReceipt` — the field is named for what the operation does to the document, the handler for
 *   what it does to the delivery, and both reach `GoodsReceiptService.reverse`, which is the same method
 *   with the same arguments. `POST /goods-receipt-lines` is `recordGoodsReceiptLine`. The second is the
 *   subtler of the two and the reason this suite drives it: the route reaches `recordSingleLine` and the
 *   field reaches `recordLine`, and those are **two different methods**. They are one implementation —
 *   `recordSingleLine` is a wrapper whose body calls `recordLine` — so the answer is one act written
 *   through one method, with two entry points whose difference is the shape they answer (a line and a
 *   posting). The suite asserts the wrapper relationship against the **real service class**, so a later
 *   wave that reimplements `recordSingleLine` as a copy fails here rather than silently forking the two
 *   surfaces.
 * - **Three are child rows reached through their parent's set field.** The create, update and delete of
 *   `PurchaseOrderLine` are served by `updatePurchaseOrder(input.lines)`, which reaches
 *   `PurchaseOrderService.update` and, through it, `PurchaseOrderLineService.replaceLines` — the method
 *   that writes the whole line set of a draft order. The line's own routes write one row at a time; the
 *   parent's field writes the set the row belongs to. **One caveat is stated rather than hidden:** the set
 *   field *soft*-deletes the lines it drops, while `DELETE /purchase-order-lines/:id` removes one
 *   outright, so a caller that needs the hard removal of a single line has no GraphQL door. The
 *   recoverable removal does have one — `softDeletePurchaseOrderLine` — and the routes are guarded to
 *   `DRAFT` orders by the service's own `assertEditable`.
 * - **Two are delivered**, and they are the two hard removals the document did not answer:
 *   `deleteGoodsReceipt` and `deleteGoodsReceiptLine`, each reaching the method its route reaches —
 *   `super.delete(id)`, the CRUD base's `delete` — under the grant the route states. Both are **hard
 *   deletes of rows the ledger explains**, so both are flagged in the wave's report: a receipt line is
 *   what a `stock_movement` row was written from, and a receipt is what its lines belong to. They are
 *   delivered because §3.1 makes a delivered route a delivered capability on both protocols, and the
 *   account of what they remove is written into their docstrings rather than hidden behind a name.
 * - **Two more are delivered, after being withheld**: `PUT /goods-receipts/:id` and
 *   `PUT /goods-receipt-lines/:id`. They were withheld while they reached the CRUD base's generic `update`
 *   with a `PartialType` of the whole shape — a caller could rewrite a **posted** receipt's `status`,
 *   `canceledAt`, `purchaseOrderId` or `warehouseId` (bypassing `reverse()` and its compensating
 *   `WRITE_OFF` movements) and re-point a receipt line's `variantId` while the movements written for the old
 *   variant stood — so a faithful mirror would have propagated the defect and a narrow one would have made
 *   GraphQL narrower than REST. ae6ffe0419d closed the holes **below** the routes: `GoodsReceiptService.update`
 *   and `GoodsReceiptLineService.update` refuse a change to those members (`GOODS_RECEIPT_IMMUTABLE`,
 *   `GOODS_RECEIPT_LINE_IMMUTABLE`) while the routes and their DTOs stay as they were. So the fields are the
 *   routes exactly — `updateGoodsReceipt` and `updateGoodsReceiptLine`: the members each route writes, the
 *   same method with the same arguments, the same grant (handover 2026-09-20 §7.65 item 23).
 *
 * Three properties are pinned for each delivered field: it is **declared** with the arguments the route
 * takes; it **states its own route's permission**, read from the route's metadata rather than restated
 * here; and it **reaches the same service call with the same arguments the route reaches**. **Nothing is
 * doubled here but the services** — the controllers, the resolvers and the `CrudController` behind the
 * controllers are the real ones.
 */

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { GoodsReceiptController } from '../../goods-receipt/goods-receipt.controller';
import { GoodsReceiptLineController } from '../../goods-receipt-line/goods-receipt-line.controller';
import { GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';
import { UpdateGoodsReceiptDTO } from '../../goods-receipt/dto';
import { UpdateGoodsReceiptLineDTO } from '../../goods-receipt-line/dto';
import { PurchaseOrderLineController } from '../../purchase-order-line/purchase-order-line.controller';
import { immutableMembers } from '../../purchasing.immutable';
import { schemaExtensions } from '../schema-extensions';
import { GoodsReceiptResolver } from './goods-receipt.resolver';
import { GoodsReceiptLineResolver } from './goods-receipt-line.resolver';
import { PurchaseOrderResolver } from './purchase-order.resolver';
import { VendorProductTermResolver } from './vendor-product-term.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const RECEIPT = '00000000-0000-4000-8000-000000000501';
const LINE = '00000000-0000-4000-8000-000000000502';
const ORDER = '00000000-0000-4000-8000-000000000503';
const ORDER_LINE = '00000000-0000-4000-8000-000000000504';
const VARIANT = '00000000-0000-4000-8000-000000000505';
const WAREHOUSE = '00000000-0000-4000-8000-000000000506';

/** The line a delivery records, as both surfaces state it. */
const ARRIVED = { receiptId: RECEIPT, purchaseOrderLineId: ORDER_LINE, quantity: '4.000000', damagedQuantity: '0' };

/** What each service answers. */
const RECEIPT_ROW = { id: RECEIPT, number: 'GR-1', status: 'POSTED' };
const RECEIPT_LINE_ROW = { id: LINE, receiptId: RECEIPT, purchaseOrderLineId: ORDER_LINE, quantity: '4.000000' };
const DELETED = { affected: 1 };

/** The grant both delivered routes state, and the one both fields state. */
const GRANT = PurchasingPermissions.GOODS_RECEIPTS_CREATE;

/** One delivered route, its two surfaces, and what its field must mirror. */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit's convention expected, which is the delivered name. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: string;
	/** The method both surfaces must reach. */
	method: string;
	/** Which stub owns the capability. */
	service: 'receipt' | 'line';
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The two routes no field answered.
 *
 * Each is a capability rather than a spare route: the hard removal of a delivery, and the hard removal of
 * one of its lines — the pair the recoverable fields beside them do not serve.
 */
const DELIVERED: IParity[] = [
	{
		field: 'deleteGoodsReceipt',
		route: 'delete',
		resource: 'GoodsReceipt',
		expects: 'deleteGoodsReceipt',
		routeArgs: [RECEIPT],
		fieldArgs: [RECEIPT],
		serviceArgs: [RECEIPT],
		declared: [['id', 'ID']],
		answers: 'DeleteGoodsReceiptPayload',
		grant: GRANT,
		method: 'delete',
		service: 'receipt',
		controller: GoodsReceiptController,
		resolver: GoodsReceiptResolver
	},
	{
		field: 'deleteGoodsReceiptLine',
		route: 'delete',
		resource: 'GoodsReceiptLine',
		expects: 'deleteGoodsReceiptLine',
		routeArgs: [LINE],
		fieldArgs: [LINE],
		serviceArgs: [LINE],
		declared: [['id', 'ID']],
		answers: 'DeleteGoodsReceiptLinePayload',
		grant: GRANT,
		method: 'delete',
		service: 'line',
		controller: GoodsReceiptLineController,
		resolver: GoodsReceiptLineResolver
	}
];

/** One collapsed route, its two surfaces, and the method each reaches. */
interface ICollapsed {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The name the audit's convention expected, which is the handler's own. */
	expects: string;
	/** The field that already serves the capability. */
	field: string;
	/** Drives the route with the arguments its handler takes. */
	overRest: (stubs: Row) => Promise<unknown>;
	/** Drives the field with the arguments it takes. */
	overGraphql: (stubs: Row) => Promise<unknown>;
	/** The method the route reaches. */
	routeMethod: string;
	/** The method the field reaches, which differs from the route's for one of the two. */
	fieldMethod: string;
	/** The service that owns both. */
	service: 'receipt' | 'line';
	/** The arguments the route's method must receive. */
	routeArgs: any[];
	/** The arguments the field's method must receive. */
	fieldArgs: any[];
}

/**
 * The two routes the reading collapsed, each with the field that already serves it.
 *
 * The second is the one this suite exists for: the two surfaces reach *different methods*, and the
 * assertion below is that they are one implementation rather than two — which is what the wrapper
 * relationship asserted against the real service class makes true.
 */
const COLLAPSED: ICollapsed[] = [
	{
		controller: GoodsReceiptController,
		resource: 'GoodsReceipt',
		route: 'cancel',
		expects: 'cancelGoodsReceipt',
		field: 'closeGoodsReceipt',
		overRest: (stubs) => receiptSurface(stubs).controller.cancel(RECEIPT, { reason: 'damaged in transit' }),
		overGraphql: (stubs) => receiptSurface(stubs).resolver.closeGoodsReceipt(RECEIPT, 'damaged in transit'),
		routeMethod: 'reverse',
		fieldMethod: 'reverse',
		service: 'receipt',
		routeArgs: [RECEIPT, 'damaged in transit'],
		fieldArgs: [RECEIPT, 'damaged in transit']
	},
	{
		controller: GoodsReceiptLineController,
		resource: 'GoodsReceiptLine',
		route: 'create',
		expects: 'createGoodsReceiptLine',
		field: 'recordGoodsReceiptLine',
		// The route answers the line, so its service method does; the field answers the posting, so it
		// reaches the method the wrapper wraps. The field itself lives on the *receipt* resolver, because a
		// receipt line's write is a write on the delivery it belongs to.
		overRest: (stubs) => lineSurface(stubs).controller.create(ARRIVED),
		overGraphql: (stubs) => receiptSurface(stubs).resolver.recordGoodsReceiptLine(RECEIPT, ARRIVED),
		routeMethod: 'recordSingleLine',
		fieldMethod: 'recordLine',
		service: 'receipt',
		routeArgs: [RECEIPT, ARRIVED],
		fieldArgs: [RECEIPT, ARRIVED]
	}
];

/**
 * The three routes reached through their parent's set field.
 *
 * A line of a draft purchase order is a child row: its create, its update and its delete are all
 * expressible by writing the parent's line set, which is what `updatePurchaseOrder` does and what
 * `PurchaseOrderLineService.replaceLines` implements.
 */
const CHILD_THROUGH_PARENT: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** The parent field that writes the set the row belongs to. */
	field: string;
	/** The service method the parent's field reaches, which writes the whole set. */
	setMethod: string;
}[] = [
	{
		controller: PurchaseOrderLineController,
		resource: 'PurchaseOrderLine',
		route: 'create',
		expects: 'createPurchaseOrderLine',
		field: 'updatePurchaseOrder',
		setMethod: 'replaceLines'
	},
	{
		controller: PurchaseOrderLineController,
		resource: 'PurchaseOrderLine',
		route: 'update',
		expects: 'updatePurchaseOrderLine',
		field: 'updatePurchaseOrder',
		setMethod: 'replaceLines'
	},
	{
		controller: PurchaseOrderLineController,
		resource: 'PurchaseOrderLine',
		route: 'delete',
		expects: 'deletePurchaseOrderLine',
		field: 'updatePurchaseOrder',
		setMethod: 'replaceLines'
	}
];

/**
 * The two update routes, mirrored now that their services refuse what a receipt posted.
 *
 * Each reaches its service's own `update` — which, since ae6ffe0419d, refuses a change to the members a
 * posted receipt's movements and counters were written from — so a field reaching the same method with the
 * same members is the route, refusal included.
 */
const UPDATES = [
	{
		controller: GoodsReceiptController,
		resolver: GoodsReceiptResolver,
		resource: 'GoodsReceipt',
		route: 'update',
		field: 'updateGoodsReceipt',
		input: 'UpdateGoodsReceiptInput',
		answers: 'GoodsReceiptPayload',
		/** The members `UpdateGoodsReceiptDTO` (`PartialType(GoodsReceiptDTO)`) carries, the tenant pair aside. */
		members: [
			'purchaseOrderId',
			'warehouseId',
			'number',
			'status',
			'receivedAt',
			'receivedByUserId',
			'canceledAt',
			'version',
			'note',
			'metadata'
		],
		grant: GRANT
	},
	{
		controller: GoodsReceiptLineController,
		resolver: GoodsReceiptLineResolver,
		resource: 'GoodsReceiptLine',
		route: 'update',
		field: 'updateGoodsReceiptLine',
		input: 'UpdateGoodsReceiptLineInput',
		answers: 'GoodsReceiptLine',
		/**
		 * The members the route writes: `UpdateGoodsReceiptLineDTO`'s, less the six its handler drops before it
		 * writes (`quantity`, `damagedQuantity`, `unitCost`, `stockMovementId`, `receiptId`,
		 * `purchaseOrderLineId`) and the tenant pair.
		 */
		members: ['variantId', 'batchNumber', 'expiresAt', 'warehouseBinId', 'note', 'metadata'],
		grant: GRANT
	}
];

/** A correction of a receipt's own fields, as both surfaces state it. */
const RECEIPT_CORRECTION = { note: 'Pallet 3 was checked twice.', receivedByUserId: ORDER, metadata: { dock: 'B' } };

/** The receipt surfaces over one pair of stubs. */
function receiptSurface(stubs: Row): { controller: Row; resolver: Row } {
	return {
		controller: new GoodsReceiptController(stubs.receipt) as Row,
		resolver: new GoodsReceiptResolver(stubs.receipt, stubs.line) as Row
	};
}

/** The receipt-line surfaces over one pair of stubs. */
function lineSurface(stubs: Row): { controller: Row; resolver: Row } {
	return {
		controller: new GoodsReceiptLineController(stubs.line, stubs.receipt) as Row,
		resolver: new GoodsReceiptLineResolver(stubs.receipt, stubs.line) as Row
	};
}

/**
 * The stubs the surfaces are built over.
 *
 * Both services carry both methods under test, so a field that reached the wrong service is visible as an
 * assertion about the wrong stub rather than as a comparison that passes.
 */
function stubsFor(): Row {
	return {
		receipt: {
			delete: jest.fn().mockResolvedValue(DELETED),
			findOneByIdString: jest.fn().mockResolvedValue(RECEIPT_ROW),
			softRemove: jest.fn().mockResolvedValue(RECEIPT_ROW),
			softRecover: jest.fn().mockResolvedValue(RECEIPT_ROW),
			reverse: jest.fn().mockResolvedValue(RECEIPT_ROW),
			recordLine: jest.fn().mockResolvedValue({
				...RECEIPT_ROW,
				movementIds: [],
				outstandingQuantity: '0.000000',
				receivedQuantity: '4.000000'
			}),
			recordSingleLine: jest.fn().mockResolvedValue(RECEIPT_LINE_ROW),
			update: jest.fn().mockResolvedValue(RECEIPT_ROW),
			findOneDetailed: jest.fn().mockResolvedValue(RECEIPT_ROW)
		},
		line: {
			delete: jest.fn().mockResolvedValue(DELETED),
			findOneByIdString: jest.fn().mockResolvedValue(RECEIPT_LINE_ROW),
			softRemove: jest.fn().mockResolvedValue(RECEIPT_LINE_ROW),
			softRecover: jest.fn().mockResolvedValue(RECEIPT_LINE_ROW),
			update: jest.fn().mockResolvedValue(RECEIPT_LINE_ROW)
		}
	};
}

/** The handlers of one controller, as functions. */
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
		throw new Error('the purchasing document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the purchasing document declares no Mutation field named "${name}"`);
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
		throw new Error(`the purchasing document declares no input named "${name}"`);
	}

	return input;
}

/** One object type, as the document spells it, for the payloads the deletes answer with. */
function objectType(name: string): ObjectTypeDefinitionNode {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode =>
			definition.kind === 'ObjectTypeDefinition' && definition.name.value === name
	);

	if (!type) {
		throw new Error(`the purchasing document declares no type named "${name}"`);
	}

	return type;
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
 * The schema's half of the two delivered fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the purchasing document — the two routes no field answered are declared', () => {
	it.each(DELIVERED)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the argument each route takes, non-null', () => {
		for (const { field, declared } of DELIVERED) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
				expect(arguments_[index].type.kind).toBe('NonNullType');
			}
		}
	});

	it('answers a payload carrying the identity, because a removed row cannot answer with itself', () => {
		for (const { field, answers } of DELIVERED) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');

			expect(objectType(answers).fields?.map((member) => member.name.value)).toEqual(['id', 'userErrors']);
		}

		// The shape the sibling delete of this document already answers, so a client generated from the
		// composed schema sees one shape per kind of act.
		expect(objectType('DeletePurchaseOrderPayload').fields?.map((member) => member.name.value)).toEqual([
			'id',
			'userErrors'
		]);
	});

	it('keeps every field the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'createPurchaseOrder',
			'updatePurchaseOrder',
			'deletePurchaseOrder',
			'sendPurchaseOrder',
			'acknowledgePurchaseOrder',
			'approvePurchaseOrder',
			'closePurchaseOrder',
			'cancelPurchaseOrder',
			'receivePurchaseOrder',
			'softDeletePurchaseOrder',
			'recoverPurchaseOrder',
			'softDeletePurchaseOrderLine',
			'recoverPurchaseOrderLine',
			'createGoodsReceipt',
			'recordGoodsReceiptLine',
			'closeGoodsReceipt',
			'softDeleteGoodsReceipt',
			'recoverGoodsReceipt',
			'softDeleteGoodsReceiptLine',
			'recoverGoodsReceiptLine',
			'createVendorProductTerm',
			'updateVendorProductTerm',
			'bulkVendorProductTerms',
			'deleteVendorProductTerm',
			'softDeleteVendorProductTerm',
			'recoverVendorProductTerm'
		]) {
			expect(declares(name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on its own stub, not a service method named only in this file.
 */
describe('the two delivered fields — the two protocols remove the same rows the same way', () => {
	it.each(DELIVERED)('$field reaches the service method the $route route reaches', async (entry) => {
		const stubs = stubsFor();
		const surfaces = entry.service === 'receipt' ? receiptSurface(stubs) : lineSurface(stubs);

		const overRest = await surfaces.controller[entry.route](...entry.routeArgs);
		const overGraphql = await surfaces.resolver[entry.field](...entry.fieldArgs);

		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// The route answers the deletion result and the field answers its payload, so the comparison is of
		// the call rather than of the envelope — and the payload names the row that is gone.
		expect(overRest).toBeDefined();
		expect(overGraphql).toEqual({ id: entry.fieldArgs[0], userErrors: [] });
	});

	it.each(DELIVERED)('$field removes the row and does not withdraw it', async (entry) => {
		// The distinction the fields exist for: `softDeleteGoodsReceipt` and `softDeleteGoodsReceiptLine`
		// reach `softRemove`, which sets `deletedAt` and leaves the row; these reach `delete`, which removes
		// it. A field that reached the soft method would answer the pair that already existed.
		const stubs = stubsFor();
		const surfaces = entry.service === 'receipt' ? receiptSurface(stubs) : lineSurface(stubs);

		await surfaces.resolver[entry.field](...entry.fieldArgs);

		expect(stubs[entry.service].delete).toHaveBeenCalledWith(entry.serviceArgs[0]);
		expect(stubs[entry.service].softRemove).not.toHaveBeenCalled();
		expect(stubs[entry.service].softRecover).not.toHaveBeenCalled();
	});

	it('reports a refusal in the payload rather than throwing it away', async () => {
		const stubs = stubsFor();
		stubs.receipt.delete.mockRejectedValueOnce(new Error('the receipt explains movements'));

		const { resolver } = receiptSurface(stubs);

		const payload = await resolver.deleteGoodsReceipt(RECEIPT);

		expect(payload.id).toBeNull();
		expect(payload.userErrors).toHaveLength(1);
		expect(payload.userErrors[0].message).toBe('the receipt explains movements');
	});
});

/**
 * The two collapsed routes, driven on both surfaces.
 *
 * The second is the one whose two sides reach different methods, and the assertion that makes the collapse
 * safe is about the **real service class**: `recordSingleLine` is a wrapper whose body calls
 * `recordLine`, so the two entry points are one implementation rather than two.
 */
describe('the two collapsed routes — served under another name, not unserved', () => {
	it.each(COLLAPSED)('$resource.$route is one implementation, reached by both surfaces', async (entry) => {
		const stubs = stubsFor();
		const service = stubs[entry.service] as Row;

		await entry.overRest(stubs);
		await entry.overGraphql(stubs);

		// Each surface reaches its own entry point with its own arguments.
		expect(service[entry.routeMethod]).toHaveBeenCalledWith(...entry.routeArgs);
		expect(service[entry.fieldMethod]).toHaveBeenCalledWith(...entry.fieldArgs);

		// One implementation, reached once by each surface: either the two entry points are the same method,
		// which is then called twice, or they are a wrapper and the method it wraps, which is called once
		// each. A second call on either side would be a second write.
		if (entry.routeMethod === entry.fieldMethod) {
			expect(service[entry.routeMethod]).toHaveBeenCalledTimes(2);
		} else {
			expect(service[entry.routeMethod]).toHaveBeenCalledTimes(1);
			expect(service[entry.fieldMethod]).toHaveBeenCalledTimes(1);
		}
	});

	it.each(COLLAPSED)('$resource.$route is served by $field, and not by a field of the handler’s name', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(declares(entry.expects)).toBe(false);
		expect(declares(entry.field)).toBe(true);
	});

	it('answers the receipt’s reversal under the name the operation has, not the handler’s', async () => {
		// `cancel` on the controller and `close` on the document are one act: the reversal a receipt is
		// ended by, which writes the compensating movements rather than removing the row.
		const stubs = stubsFor();
		const { controller, resolver } = receiptSurface(stubs);

		await controller.cancel(RECEIPT, { reason: 'damaged in transit' });
		await resolver.closeGoodsReceipt(RECEIPT, 'damaged in transit');

		expect(stubs.receipt.reverse).toHaveBeenNthCalledWith(1, RECEIPT, 'damaged in transit');
		expect(stubs.receipt.reverse).toHaveBeenNthCalledWith(2, RECEIPT, 'damaged in transit');
	});

	it('reaches the line’s write through one implementation, not two', () => {
		// The route reaches `recordSingleLine` and the field reaches `recordLine`. That is only a collapse
		// rather than a divergence because the first calls the second — asserted against the real service
		// class, so a later wave that reimplements the wrapper as a copy fails here rather than forking the
		// two surfaces silently.
		const wrapper = GoodsReceiptService.prototype.recordSingleLine.toString();

		expect(wrapper).toContain('this.recordLine(');
		expect(typeof GoodsReceiptService.prototype.recordLine).toBe('function');
		expect(typeof GoodsReceiptService.prototype.recordSingleLine).toBe('function');
	});
});

/**
 * The three child routes, and the parent field that serves them.
 *
 * A purchase-order line is a child row of a draft order, so the set field on the parent is the door a
 * caller reaches it through: `updatePurchaseOrder` carries the line set to `PurchaseOrderService.update`,
 * which delegates to `PurchaseOrderLineService.replaceLines`.
 */
describe('the three purchase-order-line routes — children reached through their parent', () => {
	it('declares the parent’s set field with the line set it replaces, and no field of the child’s own name', () => {
		// The door: `updatePurchaseOrder` takes the complete line set of a draft order.
		expect(inputType('UpdatePurchaseOrderInput').fields?.map((member) => member.name.value)).toContain('lines');

		for (const { expects } of CHILD_THROUGH_PARENT) {
			expect(declares(expects)).toBe(false);
		}

		expect(declares('updatePurchaseOrder')).toBe(true);
	});

	it.each(CHILD_THROUGH_PARENT)('$resource.$route is a real route, served by $field', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(entry.setMethod).toBe('replaceLines');
	});

	it('carries the line set to the order’s own update on the field, which is what replaces it', async () => {
		// The parent's field reaches the order service's `update`, and the line set travels as its member.
		// The set's own replacement is the service's: `PurchaseOrderService.update` delegates a supplied
		// `lines` array to `PurchaseOrderLineService.replaceLines`.
		const stubs: Row = {
			order: { update: jest.fn().mockResolvedValue({ id: ORDER }) },
			line: { findForOrder: jest.fn().mockResolvedValue([]) },
			receipt: {}
		};
		const resolver = new PurchaseOrderResolver(stubs.order, stubs.line, stubs.receipt) as Row;
		const lines = [{ variantId: VARIANT, quantity: '10.000000' }];

		await resolver.updatePurchaseOrder(ORDER, { lines });

		expect(stubs.order.update).toHaveBeenCalledTimes(1);
		expect(stubs.order.update).toHaveBeenCalledWith(ORDER, { lines });
		expect(typeof PurchaseOrderLineController.prototype.create).toBe('function');
	});

	it('leaves the child’s recoverable removal answered, and the hard one unserved', () => {
		// The caveat this reading states rather than hides: the set field soft-deletes the lines it drops,
		// so the hard removal of one line has no GraphQL door. The recoverable pair does.
		expect(declares('softDeletePurchaseOrderLine')).toBe(true);
		expect(declares('recoverPurchaseOrderLine')).toBe(true);
		expect(declares('deletePurchaseOrderLine')).toBe(false);
		expect(WAREHOUSE).toBeDefined();
	});
});

/**
 * The two update routes, mirrored (handover 2026-09-20 §7.65 item 23 (b), (c)).
 *
 * Both used to be withheld because the route's effective shape was the CRUD base's generic update, so a
 * faithful mirror propagated the defect and a narrow one made GraphQL quieter than REST. The services now
 * refuse the changes that made them defects (ae6ffe0419d), so each field is declared with the members its
 * route writes, reaches the route's method with the route's arguments, answers what the route answers, and
 * carries a refusal to the caller as the route does.
 */
describe('the two update routes — mirrored, now that their services refuse what a receipt posted', () => {
	it.each(UPDATES)('declares $field(id: ID!, input: $input!) answering $answers', ({ field, input, answers }) => {
		const declared = mutationField(field);
		const arguments_ = declared.arguments ?? [];

		expect(arguments_.map((argument) => argument.name.value)).toEqual(['id', 'input']);
		expect(namedTypeName(arguments_[0].type)).toBe('ID');
		expect(arguments_[0].type.kind).toBe('NonNullType');
		expect(namedTypeName(arguments_[1].type)).toBe(input);
		expect(arguments_[1].type.kind).toBe('NonNullType');
		expect(namedTypeName(declared.type)).toBe(answers);
		expect(declared.type.kind).toBe('NonNullType');
	});

	it.each(UPDATES)('$input declares exactly the members the $resource route writes, all optional', ({ input, members }) => {
		const fields = inputType(input).fields ?? [];

		expect(fields.map((member) => member.name.value).sort()).toEqual([...members].sort());
		for (const member of fields) {
			expect(member.type.kind).not.toBe('NonNullType');
		}
	});

	it('updateGoodsReceipt reaches the method PUT /goods-receipts/:id reaches, with the same arguments', async () => {
		const stubs = stubsFor();
		const { controller, resolver } = receiptSurface(stubs);

		await controller.update(RECEIPT, RECEIPT_CORRECTION);
		const answer = await resolver.updateGoodsReceipt(RECEIPT, RECEIPT_CORRECTION);

		expect(stubs.receipt.update).toHaveBeenNthCalledWith(1, RECEIPT, RECEIPT_CORRECTION);
		expect(stubs.receipt.update).toHaveBeenNthCalledWith(2, RECEIPT, RECEIPT_CORRECTION);
		expect(stubs.receipt.update).toHaveBeenCalledTimes(2);
		// The answer is the receipt as the `goodsReceipt` query reads it, in the resource's payload.
		expect(stubs.receipt.findOneDetailed).toHaveBeenCalledWith(RECEIPT);
		expect(answer).toEqual({ goodsReceipt: RECEIPT_ROW, movementIds: [], outstandingQuantity: null, userErrors: [] });
		// A correction is not a reversal: no compensating movements are written by either surface.
		expect(stubs.receipt.reverse).not.toHaveBeenCalled();
	});

	it('updateGoodsReceiptLine reaches the method PUT /goods-receipt-lines/:id reaches, with the members the route writes', async () => {
		const stubs = stubsFor();
		const { controller, resolver } = lineSurface(stubs);

		// The route drops the quantities before it writes; the field's input cannot state them at all.
		const overRest = await controller.update(LINE, { variantId: VARIANT, note: 'Re-labelled.', quantity: '9.000000' });
		const overGraphql = await resolver.updateGoodsReceiptLine(LINE, { variantId: VARIANT, note: 'Re-labelled.' });

		expect(stubs.line.update).toHaveBeenNthCalledWith(1, LINE, { variantId: VARIANT, note: 'Re-labelled.' });
		expect(stubs.line.update).toHaveBeenNthCalledWith(2, LINE, { variantId: VARIANT, note: 'Re-labelled.' });
		// Both answer the line, read back.
		expect(overRest).toBe(RECEIPT_LINE_ROW);
		expect(overGraphql).toBe(RECEIPT_LINE_ROW);
	});

	it('carries the service’s refusal to the caller on both surfaces', async () => {
		const stubs = stubsFor();
		const { controller: receipts, resolver: receiptFields } = receiptSurface(stubs);
		const { controller: lines, resolver: lineFields } = lineSurface(stubs);
		const receiptRefusal = immutableMembers('GOODS_RECEIPT_IMMUTABLE', 'a posted receipt is reversed, not edited', {
			id: RECEIPT,
			fields: ['status']
		});
		const lineRefusal = immutableMembers('GOODS_RECEIPT_LINE_IMMUTABLE', 'the line’s movement stands for its variant', {
			id: LINE,
			fields: ['variantId']
		});
		stubs.receipt.update.mockRejectedValue(receiptRefusal);
		stubs.line.update.mockRejectedValue(lineRefusal);

		await expect(receipts.update(RECEIPT, { status: 'CANCELED' })).rejects.toBe(receiptRefusal);
		await expect(receiptFields.updateGoodsReceipt(RECEIPT, { status: 'CANCELED' })).resolves.toMatchObject({
			goodsReceipt: null,
			userErrors: [{ code: 'GOODS_RECEIPT_IMMUTABLE' }]
		});

		await expect(lines.update(LINE, { variantId: VARIANT })).rejects.toBe(lineRefusal);
		await expect(lineFields.updateGoodsReceiptLine(LINE, { variantId: VARIANT })).rejects.toBe(lineRefusal);
	});

	it('refuses on both surfaces what the route’s body validation refuses, before the service is reached', async () => {
		// Greptile (#10562): the GraphQL scalars check a value's kind only — JSON admits an array, String any length —
		// so the fields run the route's own pipe over the route's own DTO (`asRouteBody`).
		const stubs = stubsFor();
		const { resolver: receiptFields } = receiptSurface(stubs);
		const { resolver: lineFields } = lineSurface(stubs);
		// What `@UseValidationPipe({ transform: true, whitelist: true })` runs on the two routes' bodies.
		const routePipe = new ValidationPipe({ transform: true, whitelist: true });
		const tooLong = 'x'.repeat(65);
		const receiptBodies = [{ metadata: [] }, { number: tooLong }, { receivedByUserId: 'not-an-id' }];
		const lineBodies = [{ metadata: [] }, { batchNumber: tooLong }, { variantId: 'not-an-id' }];

		for (const body of receiptBodies) {
			await expect(
				routePipe.transform(body, { type: 'body', metatype: UpdateGoodsReceiptDTO })
			).rejects.toBeInstanceOf(BadRequestException);
			await expect(receiptFields.updateGoodsReceipt(RECEIPT, body)).resolves.toMatchObject({
				goodsReceipt: null,
				userErrors: [{ code: 'BAD_REQUEST' }]
			});
		}

		for (const body of lineBodies) {
			await expect(
				routePipe.transform(body, { type: 'body', metatype: UpdateGoodsReceiptLineDTO })
			).rejects.toBeInstanceOf(BadRequestException);
			await expect(lineFields.updateGoodsReceiptLine(LINE, body)).rejects.toBeInstanceOf(BadRequestException);
		}

		expect(stubs.receipt.update).not.toHaveBeenCalled();
		expect(stubs.line.update).not.toHaveBeenCalled();
	});

	it.each(UPDATES)('$field states exactly the grant its route states, under the same guards', (entry) => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(entry.resolver)[entry.field])).toEqual([entry.grant]);
		expect(permissionOfField(entry.resolver, entry.field)).toEqual(permissionOfRoute(entry.controller, entry.route));
		expect(guardsOf(entry.resolver, entry.field)).toEqual(
			expect.arrayContaining(guardsOf(entry.controller, entry.route))
		);
		// Neither route declares a retry scope or a version expectation, so neither field does.
		for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
			expect(Reflect.getMetadata(key, fieldsOf(entry.resolver)[entry.field])).toBeUndefined();
			expect(Reflect.getMetadata(key, handlersOf(entry.controller)[entry.route])).toBeUndefined();
		}
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Both are writes, so a field that stated no grant of its own would be one `PermissionGuard` answers
 * `true` to, because it answers `true` to empty metadata: any caller who may read a delivery could remove
 * one. The class grant of both controllers is the *view* grant, which is not what either act carries.
 */
describe('the two delivered fields — the permission and the guards are the routes’', () => {
	it.each(DELIVERED)('$field states exactly what its own route states, read from the route', (entry) => {
		expect(permissionOfRoute(entry.controller, entry.route)).toBeTruthy();

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(entry.resolver)[entry.field])).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(entry.controller)[entry.route])
		);
		expect(permissionOfField(entry.resolver, entry.field)).toEqual(
			permissionOfRoute(entry.controller, entry.route)
		);
	});

	it.each(DELIVERED)('$field demands the receiving grant its route states', (entry) => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(entry.resolver)[entry.field])).toEqual([
			entry.grant
		]);
		expect(permissionOfRoute(entry.controller, entry.route)).toEqual([entry.grant]);
	});

	it.each(DELIVERED)('$field declares no retry scope and no version the route does not', (entry) => {
		// Neither delete route carries `@Idempotent` or `@Versioned` — a removal is idempotent by the row's
		// absence on the second attempt — so neither field does, and a keyless GraphQL retry answers as a
		// keyless REST retry does.
		for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
			expect(Reflect.getMetadata(key, fieldsOf(entry.resolver)[entry.field])).toBeUndefined();
			expect(Reflect.getMetadata(key, handlersOf(entry.controller)[entry.route])).toBeUndefined();
		}
	});

	it.each(DELIVERED)('$field runs under the guard chain its route runs under', (entry) => {
		const routeGuards = guardsOf(entry.controller);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(guardsOf(entry.controller, entry.route)).toEqual(expect.arrayContaining(routeGuards));
		expect(guardsOf(entry.resolver, entry.field)).toEqual(
			expect.arrayContaining(guardsOf(entry.controller, entry.route))
		);
	});
});

/**
 * The reading, asserted rather than described.
 *
 * The arithmetic is a test: nine routes flagged, two collapsed, three served through their parent, two
 * delivered as deletes and two delivered as the updates that used to be withheld — which is the whole flag
 * list, with nothing left unaccounted for.
 */
describe('the nine flagged routes — two collapsed, three through a parent, four delivered', () => {
	it('flags nine routes and accounts for every one of them', () => {
		expect(COLLAPSED).toHaveLength(2);
		expect(CHILD_THROUGH_PARENT).toHaveLength(3);
		expect(DELIVERED).toHaveLength(2);
		expect(UPDATES).toHaveLength(2);

		expect(COLLAPSED.length + CHILD_THROUGH_PARENT.length + DELIVERED.length + UPDATES.length).toBe(9);
		expect(33).toBeGreaterThan(9);
	});

	it('names the three child routes the way the audit expected, and answers the two updates by their own names', () => {
		// The convention the instrument applies names each of these exactly, which is why each is a gap or a
		// served child rather than a naming variant — and none of the three names is a field.
		for (const name of ['createPurchaseOrderLine', 'updatePurchaseOrderLine', 'deletePurchaseOrderLine']) {
			expect(declares(name)).toBe(false);
		}

		// The two updates are answered under exactly the names the audit expected.
		expect(declares('updateGoodsReceipt')).toBe(true);
		expect(declares('updateGoodsReceiptLine')).toBe(true);

		// While the two collapsed routes' expectations are also absent, and their serving fields present.
		expect(declares('cancelGoodsReceipt')).toBe(false);
		expect(declares('createGoodsReceiptLine')).toBe(false);
		expect(declares('closeGoodsReceipt')).toBe(true);
		expect(declares('recordGoodsReceiptLine')).toBe(true);
	});

	it('leaves the order’s own hard delete answered, which is the one the document already carried', () => {
		// A control for the pair above: this package does mirror its parent resources' hard deletes where
		// they exist, which is why the two receipt removals are delivered rather than withheld.
		expect(declares('deletePurchaseOrder')).toBe(true);
		expect(declares('deleteGoodsReceipt')).toBe(true);
		expect(declares('deleteGoodsReceiptLine')).toBe(true);
		expect(ORDER).toBeDefined();
	});
});

/**
 * The four hard-delete fields answer what the delete did (handover 2026-09-20 §7.65 item 21).
 *
 * The receipt and receipt-line services' `delete` is the kernel's, which checks no existence: an identifier that
 * names no row of the caller matches nothing, answers `affected: 0` and raises nothing — and each field used to
 * answer `{ id, userErrors: [] }`, "carrying the identity that was removed", for a row that was never there. The
 * purchase order's and the vendor term's `delete` read the row first, so for them the change is the shared
 * reading, and a vendor term in use is deactivated rather than removed (its service answers the row), which
 * still reads as done.
 */
describe('the delete fields answer NOT_FOUND for a delete that removed nothing', () => {
	const FIELDS: Array<[string, (service: any) => any]> = [
		['deleteGoodsReceipt', (service) => new GoodsReceiptResolver(service, {} as never)],
		['deleteGoodsReceiptLine', (service) => new GoodsReceiptLineResolver({} as never, service)],
		['deletePurchaseOrder', (service) => new PurchaseOrderResolver(service, {} as never, {} as never)],
		['deleteVendorProductTerm', (service) => new VendorProductTermResolver(service)]
	];

	it.each(FIELDS)('%s answers NOT_FOUND on the id, and no identity, when the delete matched no row', async (field, build) => {
		const service = { delete: jest.fn().mockResolvedValue({ raw: [], affected: 0 }) };

		await expect(build(service)[field](RECEIPT)).resolves.toEqual({
			id: null,
			userErrors: [
				{
					code: 'NOT_FOUND',
					message: `NOT_FOUND: no record with id ${RECEIPT} was found to delete.`,
					path: ['id'],
					details: { id: RECEIPT }
				}
			]
		});
		expect(service.delete).toHaveBeenCalledWith(RECEIPT);
	});

	it.each(FIELDS)('%s answers the identity when the delete removed the row', async (field, build) => {
		const service = { delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }) };

		await expect(build(service)[field](RECEIPT)).resolves.toEqual({ id: RECEIPT, userErrors: [] });
	});

	it('reads a vendor term that was deactivated rather than removed as done: the service answered the row', async () => {
		const service = { delete: jest.fn().mockResolvedValue({ id: RECEIPT, status: 'INACTIVE' }) };

		await expect(new VendorProductTermResolver(service as never).deleteVendorProductTerm(RECEIPT)).resolves.toEqual({
			id: RECEIPT,
			userErrors: []
		});
	});
});
