import { DocumentNode, FieldDefinitionNode, InputValueDefinitionNode, ObjectTypeDefinitionNode } from 'graphql';
import { schemaExtensions } from './schema-extensions';

/**
 * The returns document's contract for the two conventions the resolvers declare.
 *
 * The schema this file contributes is composed into the one platform schema at boot, so a member the
 * mutations read but the document does not declare is a mutation no client can call — and a member
 * declared with the wrong nullability is a document that refuses the very request the kernel means to
 * answer. Both halves are pinned here: the retry key and the version are **nullable in the document**
 * even where the operation requires them, because the refusal is the kernel's to state and it answers
 * with the platform's own code, and the version a return carries is **non-null**, because every row has
 * one.
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
		throw new Error(`the returns document declares no type or input named "${name}"`);
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

/** One argument of a root field, by name. */
function argumentNamed(rootName: string, fieldName: string, argumentName: string): InputValueDefinitionNode {
	const argument = fieldNamed(rootName, fieldName).arguments?.find(
		(candidate) => candidate.name.value === argumentName
	);

	if (!argument) {
		throw new Error(`"${rootName}.${fieldName}" declares no argument named "${argumentName}"`);
	}

	return argument;
}

/** How a field or argument states its type, as the document spells it. */
function typeOf(node: FieldDefinitionNode | InputValueDefinitionNode): string {
	const named = (type: any): string => (type.kind === 'NonNullType' ? `${named(type.type)}!` : type.name.value);

	return named(node.type);
}

describe('the returns document — the version a return carries', () => {
	it('declares a non-null version on the return, because every row has one', () => {
		expect(typeOf(fieldNamed('OrderReturn', 'version'))).toBe('Int!');
	});
});

describe('the returns document — the version an operation states', () => {
	it('declares it nullable on the input that updates a return', () => {
		// Nullable on purpose: a mutation that states no version is refused by the kernel with
		// `VERSION_REQUIRED`, which is the same answer the REST route gives — a document that made the
		// member non-null would refuse the request before the kernel could answer it.
		expect(typeOf(fieldNamed('ReceiveOrderReturnInput', 'version'))).toBe('Int');
	});

	it('declares it nullable on the mutations that decide a status and take no input', () => {
		// Deciding a status takes no input of its own, so the version rides as the mutation's own
		// argument — the schema has to accept it there for a client to be able to state one at all.
		for (const mutation of ['approveOrderReturn', 'rejectOrderReturn', 'cancelOrderReturn', 'closeOrderReturn']) {
			expect(typeOf(argumentNamed('Mutation', mutation, 'version'))).toBe('Int');
		}
	});
});

describe('the returns document — the retry key', () => {
	it('declares it nullable on the input of every mutation that mirrors a decorated route', () => {
		expect(typeOf(fieldNamed('RequestOrderReturnInput', 'idempotencyKey'))).toBe('String');
		expect(typeOf(fieldNamed('ReceiveOrderReturnInput', 'idempotencyKey'))).toBe('String');
	});
});
