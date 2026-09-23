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
});
