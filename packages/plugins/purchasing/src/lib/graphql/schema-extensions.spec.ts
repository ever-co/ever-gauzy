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

/** How a field or argument states its type, as the document spells it. */
function typeOf(node: FieldDefinitionNode | InputValueDefinitionNode): string {
	const named = (type: any): string => (type.kind === 'NonNullType' ? `${named(type.type)}!` : type.name.value);

	return named(node.type);
}

describe('the purchasing document — the retry key on the inputs of the decorated mutations', () => {
	it('declares it on the input that records a delivery, which requires one', () => {
		expect(typeOf(fieldNamed('CreateGoodsReceiptInput', 'idempotencyKey'))).toBe('String');
	});

	it('declares it on the input that raises an order, which honours one when it is presented', () => {
		expect(typeOf(fieldNamed('CreatePurchaseOrderInput', 'idempotencyKey'))).toBe('String');
	});
});
