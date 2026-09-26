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

/**
 * The three line fields answer a page of rows, as the schema prints it.
 *
 * Each used to answer a bare array — `[OrderReturnLine!]!` and its two siblings — which a client can
 * neither page, count nor resume from, while the return, the claim and the exchange each already had a
 * connection of their own. The shape is asserted here as the document prints it, because the document is
 * what a client reads: an `edges` naming an edge type this file never declares fails the schema, and a
 * field that kept answering `[T!]!` while its resolver answered a connection is a client reading `nodes`
 * off an array.
 */
describe('the returns document — the three line lists answer a connection', () => {
	/** The document, with the line breaks the template writes flattened so a declaration reads as one line. */
	const schema = (schemaExtensions as any).loc.source.body.replace(/\s+/g, ' ');

	/** The body of one type, as the document prints it. */
	function bodyOf(type: string): string {
		const start = schema.indexOf(`type ${type} {`);

		return schema.slice(start, schema.indexOf('}', start));
	}

	it('declares a pageable connection, with its edge, for the return, claim and exchange lines', () => {
		const converted: Array<[string, string, string, string]> = [
			[
				'orderReturnLines(returnId: ID!, page: PageInput, withDeleted: Boolean)',
				'OrderReturnLineConnection',
				'OrderReturnLineEdge',
				'OrderReturnLine'
			],
			[
				'orderClaimLines(claimId: ID!, page: PageInput, withDeleted: Boolean)',
				'OrderClaimLineConnection',
				'OrderClaimLineEdge',
				'OrderClaimLine'
			],
			[
				'orderExchangeLines(exchangeId: ID!, page: PageInput, withDeleted: Boolean)',
				'OrderExchangeLineConnection',
				'OrderExchangeLineEdge',
				'OrderExchangeLine'
			]
		];

		for (const [field, connection, edge, row] of converted) {
			const body = bodyOf(connection);

			for (const member of [`nodes: [${row}!]!`, `edges: [${edge}!]!`, 'totalCount: Int!', 'pageInfo: PageInfo!']) {
				expect({ connection, member, declares: body.includes(member) }).toEqual({
					connection,
					member,
					declares: true
				});
			}

			// The edge is what a client walks from, so it carries the row and the cursor that addresses
			// it — the two members the connection's own `nodes` and `pageInfo` are read beside.
			const edgeBody = bodyOf(edge);

			for (const member of [`node: ${row}!`, 'cursor: String!']) {
				expect({ edge, member, declares: edgeBody.includes(member) }).toEqual({ edge, member, declares: true });
			}

			expect({ field, connection: schema.includes(`${field}: ${connection}!`) }).toEqual({ field, connection: true });
			// The control: the field no longer answers the bare array it used to, stated as the document
			// spelled it before the conversion — the field name and the one argument that identifies the
			// rows it lists.
			const wasBare = `${field.slice(0, field.indexOf(','))}: [${row}!]!`;

			expect({ wasBare, declared: schema.includes(wasBare) }).toEqual({ wasBare, declared: false });
		}
	});
});

/**
 * The soft-delete visibility the REST list routes have.
 *
 * Every REST list route inherits `withDeleted` from `BaseQueryDTO`, so a client can ask it for the rows
 * a tenant retired. The fields below are the routes' GraphQL counterparts, and a document that declares
 * no such argument tells a client it can ask for the retired rows while answering the live ones — the
 * client is refused at the schema rather than answered differently, and the two surfaces disagree about
 * what exists.
 */
describe('the returns document — the soft-delete visibility the REST list routes have', () => {
	it('declares withDeleted, nullable, on every converted list field', () => {
		for (const field of [
			'orderReturns',
			'orderReturnReasons',
			'orderClaims',
			'orderExchanges',
			'orderReturnLines',
			'orderClaimLines',
			'orderExchangeLines'
		]) {
			expect({ field, type: typeOf(argumentNamed('Query', field, 'withDeleted')) }).toEqual({
				field,
				type: 'Boolean'
			});
		}
	});
});
