import { DocumentNode, FieldDefinitionNode, InputValueDefinitionNode, ObjectTypeDefinitionNode } from 'graphql';
import { schemaExtensions } from './schema-extensions';

/**
 * The purchasing document's contract for the retry convention its resolvers declare.
 *
 * The schema this file contributes is composed into the one platform schema at boot, so a member the
 * mutations read but the document does not declare is a mutation no client can call. The key is
 * **nullable in the document** even on the mutation that requires one, because the refusal is the
 * kernel's to state and it answers with the platform's own code — a document that made the member
 * non-null would refuse the request before the kernel could answer it.
 */

/** The definitions this document declares, by name. */
function definitionNamed(name: string): ObjectTypeDefinitionNode {
	const found = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode =>
			(definition.kind === 'ObjectTypeDefinition' ||
				// The root operation types belong to the kernel, so a plugin extends them rather than
				// declaring a second `type Query` — which would be a duplicate definition.
				definition.kind === 'ObjectTypeExtension' ||
				definition.kind === 'InputObjectTypeDefinition') &&
			(definition as ObjectTypeDefinitionNode).name.value === name
	);

	if (!found) {
		throw new Error(`the purchasing document declares no type or input named "${name}"`);
	}

	return found;
}

/** One field of a type or input, by name. */
function fieldNamed(typeName: string, fieldName: string): FieldDefinitionNode {
	const field = definitionNamed(typeName).fields?.find((candidate) => candidate.name.value === fieldName);

	if (!field) {
		throw new Error(`"${typeName}" declares no field named "${fieldName}"`);
	}

	return field;
}

/**
 * How a field or argument states its type, as the document spells it.
 *
 * A list is rendered from its own member, so a field declared `[GoodsReceiptLineInput!]!` is read as the
 * document spells it rather than as a name the node does not have: the argument of a list is its element
 * type, and the two non-null marks are stated where the document states them.
 */
function typeOf(node: FieldDefinitionNode | InputValueDefinitionNode): string {
	const named = (type: any): string =>
		type.kind === 'NonNullType'
			? `${named(type.type)}!`
			: type.kind === 'ListType'
				? `[${named(type.type)}]`
				: type.name.value;

	return named(node.type);
}

/** The arguments of a field, in the order the document states them. */
function argumentNames(typeName: string, fieldName: string): string[] {
	return (fieldNamed(typeName, fieldName).arguments ?? []).map((argument) => argument.name.value);
}

/** Every field of a type or input, each as `name: Type`, in the order the document states them. */
function fieldsOf(typeName: string): string[] {
	return (definitionNamed(typeName).fields ?? []).map((field) => `${field.name.value}: ${typeOf(field)}`);
}

describe('the purchasing document — the retry key on the inputs of the decorated mutations', () => {
	it('declares it on the input that records a delivery, which requires one', () => {
		expect(typeOf(fieldNamed('CreateGoodsReceiptInput', 'idempotencyKey'))).toBe('String');
	});

	it('declares it on the input that raises an order, which honours one when it is presented', () => {
		expect(typeOf(fieldNamed('CreatePurchaseOrderInput', 'idempotencyKey'))).toBe('String');
	});
});

/**
 * The mutations that mirror purchase-order routes (doc 17 §3.1).
 *
 * A member the resolver binds and this document does not declare is a field every caller is told does
 * not exist, and a member the document declares and the resolver never reads is one a caller may state
 * and have silently ignored. The document is this package's half of that contract, so each field is
 * pinned with the arguments its route takes — including the two the receiving field deliberately does
 * **not** take, because the route does not read them.
 */
describe('the purchasing document — the mutations that mirror the purchase-order routes', () => {
	it('declares the acknowledgement and the approval as order mutations, taking what their routes take', () => {
		// The body of `POST /:id/acknowledge` is the revised date and a note; the body of
		// `POST /:id/approve` is the note alone. Both answer the order, in the payload the other order
		// mutations of this plugin answer with.
		expect(typeOf(fieldNamed('Mutation', 'acknowledgePurchaseOrder'))).toBe('PurchaseOrderPayload!');
		expect(argumentNames('Mutation', 'acknowledgePurchaseOrder')).toEqual(['id', 'expectedAt', 'note']);
		expect(typeOf(fieldNamed('Mutation', 'approvePurchaseOrder'))).toBe('PurchaseOrderPayload!');
		expect(argumentNames('Mutation', 'approvePurchaseOrder')).toEqual(['id', 'note']);
	});

	it('declares the delivery recorded from an order, with the body that route reads', () => {
		// `POST /:id/receipts` is the same operation as `POST /goods-receipts`: the path carries the order
		// so a caller already looking at one does not repeat it in the body, and the route demands no retry
		// key because the delivery is anchored to a document the caller has in hand.
		expect(typeOf(fieldNamed('Mutation', 'receivePurchaseOrder'))).toBe('GoodsReceiptPayload!');
		expect(argumentNames('Mutation', 'receivePurchaseOrder')).toEqual(['id', 'input']);

		// And the input is that body and nothing else: the order is the field's own argument, the retry key
		// is absent because the route demands none, and the location is absent because the route reads none
		// — an anchored delivery inherits the order's receiving location, so an input that accepted one
		// would tell a caller it had moved the goods somewhere it had not.
		expect(fieldsOf('ReceivePurchaseOrderInput')).toEqual([
			'receivedAt: DateTime',
			'overReceiptTolerance: Decimal',
			'note: String',
			'lines: [GoodsReceiptLineInput!]!'
		]);
	});

	it('declares the withdrawal and the recovery the inherited routes serve, answering the row', () => {
		// The CRUD base's pair, named as every other soft removal of the platform is and answering the
		// document rather than a payload, so a client generated from the composed schema sees one shape for
		// the operation wherever the operation appears.
		for (const field of ['softDeletePurchaseOrder', 'recoverPurchaseOrder']) {
			expect(typeOf(fieldNamed('Mutation', field))).toBe('PurchaseOrder!');
			expect(argumentNames('Mutation', field)).toEqual(['id']);
		}
	});

	it('declares the same pair for the line, which is read through its order and answers no other root field', () => {
		// A line has no root read: it is selected through `purchaseOrder { lines { … } }`. Its controller still
		// serves `DELETE /:id/soft` and `PUT /:id/recover` under the order-edit grant, and §3.1 makes a
		// delivered write route a delivered capability on both protocols — so the pair is the line's only root
		// field, and its absence is the asymmetry this case exists to catch.
		for (const field of ['softDeletePurchaseOrderLine', 'recoverPurchaseOrderLine']) {
			expect(typeOf(fieldNamed('Mutation', field))).toBe('PurchaseOrderLine!');
			expect(argumentNames('Mutation', field)).toEqual(['id']);
		}
	});
});

/**
 * The same inherited pair, on the three resources the purchase-order wave left (doc 17 §3.1).
 *
 * `CrudController<T>` maps `DELETE /:id/soft` and `PUT /:id/recover` for **every** controller that
 * extends it, and all five of this plugin's controllers override both routes only to state a permission
 * the inherited declaration leaves unstated. Two of the five were delivered with the purchase-order pair
 * above; the receipt, the receipt line and the negotiated term still served the pair over REST with no
 * field answering it, so a caller could withdraw a delivery, one of its lines or a supplier's standing
 * term on one protocol and not on the other. Six fields close that, and each is pinned twice:
 *
 * - **in the document**, with the identifier its route takes and the answer the resource's own mutations
 *   answer, because a field the document does not carry is one no client can select, and a field whose
 *   answer no sibling shares is a second shape invented for one act;
 * - **against its own route's metadata**, read off the controller rather than restated here, so a field
 *   that left the grant to its class would be caught: the class-level grant of all three resolvers is
 *   the VIEW grant, and a withdrawal served under a read grant is the defect the controllers' own
 *   overrides exist to close on the other surface.
 *
 * The kernel barrel is doubled, for the reason this package's other suites state: `@gauzy/core` boots
 * the application graph from its barrel, so a suite that reads one controller through it pays for the
 * platform. `Permissions` is the one decorator carried across as the platform writes it — real
 * `SetMetadata` under the real `PERMISSIONS_METADATA` key — because the two readings compared below are
 * exactly that metadata. The three controllers and the three resolvers under test are the real ones.
 */

jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;
	// The services reach the kernel's conditional write by name through this barrel, so a factory that
	// replaces the barrel has to answer for it even where no transition is exercised.
	const { ApiErrorCode, commitVersionedUpdate } = require('../testing/versioned-write.double');

	class BaseEntity {}

	/**
	 * The CRUD base, as the three controllers extend it.
	 *
	 * The two inherited routes are the subject of this suite, so they are written here as
	 * `packages/core/src/lib/core/crud/crud.controller.ts` writes them — the identifier, the rest
	 * parameter handed over as one array, and the delegation to the service — rather than omitted.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}

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
		ApiErrorCode,
		commitVersionedUpdate,
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
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The CRUD base's soft-delete routes decorate with `new AbstractValidationPipe(...)`, so the
		// controllers resolve this name at import — and `@UsePipes()` refuses a pipe with no `transform`,
		// which is the only member the declaration needs here.
		AbstractValidationPipe: class AbstractValidationPipe {
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Warehouse: class Warehouse {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
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

jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag: () => () => undefined
	}),
	{ virtual: true }
);

// The collaborators the three surfaces inject are doubled at their own modules, so nothing below them
// is loaded: what these cases assert is a declaration and a permission, not what a service returns.
jest.mock('../goods-receipt/goods-receipt.service', () => ({ GoodsReceiptService: class GoodsReceiptService {} }));
jest.mock('../goods-receipt-line/goods-receipt-line.service', () => ({
	GoodsReceiptLineService: class GoodsReceiptLineService {}
}));
jest.mock('../vendor-product-term/vendor-product-term.service', () => ({
	VendorProductTermService: class VendorProductTermService {}
}));

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { GoodsReceiptController } from '../goods-receipt/goods-receipt.controller';
import { GoodsReceiptLineController } from '../goods-receipt-line/goods-receipt-line.controller';
import { VendorProductTermController } from '../vendor-product-term/vendor-product-term.controller';
import { GoodsReceiptResolver } from './resolvers/goods-receipt.resolver';
import { GoodsReceiptLineResolver } from './resolvers/goods-receipt-line.resolver';
import { VendorProductTermResolver } from './resolvers/vendor-product-term.resolver';

/** The permission a handler or a class declares, as the guard reads it. */
const permissionOf = (surface: any, member?: string): string[] | undefined =>
	Reflect.getMetadata(PERMISSIONS_METADATA, member ? surface.prototype[member] : surface);

/**
 * Each delivered field beside the inherited route it mirrors, with the permission both of them state
 * and the type the resource's own mutations answer.
 *
 * The permissions are the strings themselves rather than the enumeration's members, because a string is
 * what the guard compares: an enumeration renamed without the catalogue moving with it would leave the
 * two surfaces agreeing with each other and disagreeing with the guard.
 *
 * The answer is the resource's own shape rather than one chosen for the act: the receipt and the term
 * answer the payload their other mutations answer (`GoodsReceiptPayload`, `VendorProductTermPayload`),
 * and the receipt line answers the row, which is what the sibling line resource of this document answers
 * too and what no payload of this document carries.
 */
const PAIRS: Array<{
	controller: any;
	resolver: any;
	route: string;
	field: string;
	answers: string;
	permission: string;
}> = [
	{
		controller: GoodsReceiptController,
		resolver: GoodsReceiptResolver,
		route: 'softRemove',
		field: 'softDeleteGoodsReceipt',
		answers: 'GoodsReceiptPayload',
		permission: 'GOODS_RECEIPTS_CREATE'
	},
	{
		controller: GoodsReceiptController,
		resolver: GoodsReceiptResolver,
		route: 'softRecover',
		field: 'recoverGoodsReceipt',
		answers: 'GoodsReceiptPayload',
		permission: 'GOODS_RECEIPTS_CREATE'
	},
	{
		controller: GoodsReceiptLineController,
		resolver: GoodsReceiptLineResolver,
		route: 'softRemove',
		field: 'softDeleteGoodsReceiptLine',
		answers: 'GoodsReceiptLine',
		permission: 'GOODS_RECEIPTS_CREATE'
	},
	{
		controller: GoodsReceiptLineController,
		resolver: GoodsReceiptLineResolver,
		route: 'softRecover',
		field: 'recoverGoodsReceiptLine',
		answers: 'GoodsReceiptLine',
		permission: 'GOODS_RECEIPTS_CREATE'
	},
	{
		controller: VendorProductTermController,
		resolver: VendorProductTermResolver,
		route: 'softRemove',
		field: 'softDeleteVendorProductTerm',
		answers: 'VendorProductTermPayload',
		permission: 'VENDOR_TERMS_EDIT'
	},
	{
		controller: VendorProductTermController,
		resolver: VendorProductTermResolver,
		route: 'softRecover',
		field: 'recoverVendorProductTerm',
		answers: 'VendorProductTermPayload',
		permission: 'VENDOR_TERMS_EDIT'
	}
];

/** The four classes these six fields sit on, each once. */
const SURFACES = [
	[GoodsReceiptController, GoodsReceiptResolver, 'GOODS_RECEIPTS_VIEW'],
	[GoodsReceiptLineController, GoodsReceiptLineResolver, 'GOODS_RECEIPTS_VIEW'],
	[VendorProductTermController, VendorProductTermResolver, 'VENDOR_TERMS_VIEW']
] as const;

describe('the purchasing document — the inherited pair of the receipt, the receipt line and the term', () => {
	it('declares each field with the identifier its route takes and the answer its resource answers', () => {
		// `DELETE /:id/soft` and `PUT /:id/recover` both take the row's id and nothing else, so a field
		// that declared a second argument would offer a caller something the route cannot receive.
		for (const { field, answers } of PAIRS) {
			expect(typeOf(fieldNamed('Mutation', field))).toBe(`${answers}!`);
			expect(argumentNames('Mutation', field)).toEqual(['id']);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act throughout; a second spelling would be a second
		// vocabulary for one capability, and a client that guessed it would find no field rather than an
		// error it could act on.
		const restored = (definitionNamed('Mutation').fields ?? [])
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('restore'));

		expect(restored).toEqual([]);
		expect((definitionNamed('Mutation').fields ?? []).map((field) => field.name.value)).toEqual(
			expect.arrayContaining(PAIRS.map(({ field }) => field))
		);
	});

	it('states on every field exactly what its own route states, read off that route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PAIRS.some(({ controller, route }) => permissionOf(controller, route))).toBe(true);

		for (const { controller, resolver, route, field, permission } of PAIRS) {
			// The override is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof controller.prototype[route]).toBe('function');

			expect(permissionOf(resolver, field)).toEqual([permission]);
			expect(permissionOf(resolver, field)).toEqual(permissionOf(controller, route));
		}
	});

	it('demands a writing grant on every field, which is what the three controllers override the routes for', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of all three resolvers is the VIEW grant, so a field that left the act to its
		// class would let a reader withdraw a delivery, one of its lines or a supplier's standing term.
		for (const [controller, resolver, view] of SURFACES) {
			expect(permissionOf(resolver)).toEqual([view]);
			expect(permissionOf(controller)).toEqual([view]);
		}

		for (const { resolver, field } of PAIRS) {
			expect(permissionOf(resolver, field)).not.toEqual(permissionOf(resolver));
		}
	});
});
