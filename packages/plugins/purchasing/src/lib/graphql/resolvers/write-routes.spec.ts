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
 * - **Two are withheld**, and the reason is the direction §3.1 forbids rather than a specification:
 *   `PUT /goods-receipts/:id` and `PUT /goods-receipt-lines/:id` reach the CRUD base's generic `update`
 *   with a `PartialType` of the whole shape, so a caller can rewrite a **posted** receipt's `status`,
 *   `canceledAt`, `purchaseOrderId` or `warehouseId` — bypassing `reverse()` and therefore writing no
 *   compensating `WRITE_OFF` movements — and can repoint a receipt line's `variantId` while the movements
 *   already written for the old variant stand. Neither can be mirrored faithfully without propagating the
 *   defect, and neither can be mirrored narrowly without making GraphQL **narrower than REST**, which is
 *   the one direction the parity rule forbids: there is no domain method here for a field to reach, so
 *   what the route effectively does is what the generic base does. Both are **owner decisions whose fix
 *   is the REST DTO**, and they are reported rather than resolved.
 *
 * Three properties are pinned for each delivered field: it is **declared** with the arguments the route
 * takes; it **states its own route's permission**, read from the route's metadata rather than restated
 * here; and it **reaches the same service call with the same arguments the route reaches**. **Nothing is
 * doubled here but the services** — the controllers, the resolvers and the `CrudController` behind the
 * controllers are the real ones.
 */

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
import { PurchaseOrderLineController } from '../../purchase-order-line/purchase-order-line.controller';
import { schemaExtensions } from '../schema-extensions';
import { GoodsReceiptResolver } from './goods-receipt.resolver';
import { GoodsReceiptLineResolver } from './goods-receipt-line.resolver';
import { PurchaseOrderResolver } from './purchase-order.resolver';

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
 * The two routes withheld rather than mirrored.
 *
 * Each exists, is declared, and reaches the CRUD base's generic `update` — so what it writes is the
 * whitelist of a `PartialType` rather than a domain method, which is why neither side of the pair can be
 * brought into parity without either propagating the defect or narrowing GraphQL below REST.
 */
const WITHHELD = [
	{
		controller: GoodsReceiptController,
		resource: 'GoodsReceipt',
		route: 'update',
		names: ['updateGoodsReceipt'],
		because:
			'the generic update can set a posted receipt’s status and canceledAt without the compensating movements reverse() writes, and can repoint its order or location'
	},
	{
		controller: GoodsReceiptLineController,
		resource: 'GoodsReceiptLine',
		route: 'update',
		names: ['updateGoodsReceiptLine'],
		because:
			'the generic update can repoint a line’s variantId while the movements already written for the old variant stand'
	}
];

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
			update: jest.fn().mockResolvedValue(RECEIPT_ROW)
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
 * The two withheld routes.
 *
 * Both exist and both write, and neither is mirrored — the reason is that the route's effective shape is
 * the CRUD base's generic update, so a faithful mirror propagates the defect and a narrow one makes
 * GraphQL quieter than REST, which §3.1 forbids. They are owner decisions whose fix is the REST DTO.
 */
describe('the two withheld routes — reported, not mirrored', () => {
	it.each(WITHHELD)('$resource.$route is a real route with no field', ({ controller, route, names }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		for (const name of names) {
			expect(declares(name)).toBe(false);
		}
	});

	it('reaches the CRUD base’s generic update on both withheld routes', async () => {
		// The defect in one assertion: the route's own method is the base's `update`, which writes whatever
		// the DTO's whitelist admits rather than what a domain method allows. A receipt is a POSTED
		// document, and its `status` is what `reverse()` is the only writer of.
		const stubs = stubsFor();
		const { controller: receipts } = receiptSurface(stubs);
		const { controller: lines } = lineSurface(stubs);

		await receipts.update(RECEIPT, { status: 'CANCELED', warehouseId: WAREHOUSE });
		await lines.update(LINE, { variantId: VARIANT });

		expect(stubs.receipt.update).toHaveBeenCalledWith(RECEIPT, {
			status: 'CANCELED',
			warehouseId: WAREHOUSE
		});
		expect(stubs.line.update).toHaveBeenCalledWith(LINE, { variantId: VARIANT });
		expect(stubs.receipt.reverse).not.toHaveBeenCalled();
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
 * delivered and two withheld — which is the whole flag list, with nothing left unaccounted for.
 */
describe('the nine flagged routes — two collapsed, three through a parent, two delivered, two withheld', () => {
	it('flags nine routes and accounts for every one of them', () => {
		expect(COLLAPSED).toHaveLength(2);
		expect(CHILD_THROUGH_PARENT).toHaveLength(3);
		expect(DELIVERED).toHaveLength(2);
		expect(WITHHELD).toHaveLength(2);

		expect(COLLAPSED.length + CHILD_THROUGH_PARENT.length + DELIVERED.length + WITHHELD.length).toBe(9);
		expect(33).toBeGreaterThan(9);
	});

	it('names the three child routes and the two withheld ones the way the audit expected', () => {
		// The convention the instrument applies names each of these exactly, which is why each is a gap,
		// a served child or a withheld route rather than a naming variant — and none of the five names is
		// a field.
		for (const name of [
			'createPurchaseOrderLine',
			'updatePurchaseOrderLine',
			'deletePurchaseOrderLine',
			'updateGoodsReceipt',
			'updateGoodsReceiptLine'
		]) {
			expect(declares(name)).toBe(false);
		}

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
