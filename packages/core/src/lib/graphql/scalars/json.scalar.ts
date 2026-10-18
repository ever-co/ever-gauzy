import { Scalar, CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, ObjectValueNode, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';

/**
 * The name the kernel schema declares this scalar under.
 */
export const JSON_SCALAR_NAME = 'JSON';

/**
 * How deep a literal document may nest.
 *
 * A `JSON` literal is written by the caller and walked by the server, so an arbitrarily deep one is
 * an arbitrarily deep recursion in the parser's own process. The bound is generous — a settings
 * document, an event payload and a metadata bag are all far below it — and it is a bound rather than
 * a guess: a document that needs more nesting than this is not a document, it is an attack or a
 * mistake, and either way a refusal naming the limit is the honest answer.
 */
export const JSON_LITERAL_MAX_DEPTH = 32;

/**
 * A document column, carried through unchanged.
 *
 * `scalar JSON` was declared in `schema/common.type.gql` and implemented nowhere. The output half of
 * an unimplemented scalar happens to be right — a pass-through is what a document wants — but the
 * input half is not: graphql-js falls back to `valueFromASTUntyped`, which reads an enum literal as a
 * bare string and has no depth bound at all, so a literal nested a few thousand levels deep is walked
 * to the bottom while the request is being parsed.
 *
 * Everything else about the value is deliberately untouched. A document column is the one place on
 * this surface where the platform has no opinion about shape, and a scalar that normalised it would
 * be changing data on its way through.
 */
@Scalar(JSON_SCALAR_NAME)
export class JsonScalar implements CustomScalar<unknown, unknown> {
	/** The description graphql-js prints for the scalar. */
	description = 'An arbitrary JSON document, carried through unchanged.';

	/**
	 * Reads a value the client sent in a variable.
	 *
	 * A variable has already been through `JSON.parse`, so it is a JSON value by construction and is
	 * returned as it stands.
	 *
	 * @param value The variable's value.
	 * @returns The same value.
	 */
	parseValue(value: unknown): unknown {
		return value;
	}

	/**
	 * Builds the document a literal describes.
	 *
	 * @param ast The literal node.
	 * @param variables The operation's variables, for a `$variable` inside the literal.
	 * @returns The document.
	 * @throws GraphQLError `VALIDATION_FAILED` when the literal nests deeper than
	 * {@link JSON_LITERAL_MAX_DEPTH}.
	 */
	parseLiteral(ast: ValueNode, variables?: Record<string, unknown> | null): unknown {
		return fromLiteral(ast, variables ?? null, 0);
	}

	/**
	 * Renders a value the server is about to send.
	 *
	 * @param value The document as the column holds it.
	 * @returns The same value.
	 */
	serialize(value: unknown): unknown {
		return value;
	}
}

/**
 * Reads one node of a literal document.
 *
 * @param ast The node.
 * @param variables The operation's variables.
 * @param depth How deep this node sits.
 * @returns The value the node describes.
 * @throws GraphQLError `VALIDATION_FAILED` below the depth bound.
 */
function fromLiteral(ast: ValueNode, variables: Record<string, unknown> | null, depth: number): unknown {
	if (depth > JSON_LITERAL_MAX_DEPTH) {
		throw new GraphQLError(`A JSON literal may not nest deeper than ${JSON_LITERAL_MAX_DEPTH} levels.`, {
			extensions: { code: ApiErrorCode.VALIDATION_FAILED, status: 400 }
		});
	}

	switch (ast.kind) {
		case Kind.STRING:
		case Kind.BOOLEAN:
			return ast.value;
		case Kind.INT:
			return Number.parseInt(ast.value, 10);
		case Kind.FLOAT:
			return Number.parseFloat(ast.value);
		case Kind.NULL:
			return null;
		case Kind.ENUM:
			// An enum literal has no JSON counterpart; its name is the value, which is the reading
			// `valueFromASTUntyped` gives it and the one a client that writes one means.
			return ast.value;
		case Kind.LIST:
			return ast.values.map((value) => fromLiteral(value, variables, depth + 1));
		case Kind.OBJECT:
			return fromObject(ast, variables, depth);
		case Kind.VARIABLE:
			return variables ? variables[ast.name.value] : undefined;
		default:
			return undefined;
	}
}

/**
 * Reads an object literal into a plain document.
 *
 * The result is built from `Object.create(null)` so a document carrying a `__proto__` member is a
 * document with a member of that name rather than an object whose prototype a caller chose.
 *
 * @param ast The object node.
 * @param variables The operation's variables.
 * @param depth How deep the object sits.
 * @returns The document.
 */
function fromObject(ast: ObjectValueNode, variables: Record<string, unknown> | null, depth: number): unknown {
	const document = Object.create(null) as Record<string, unknown>;

	for (const field of ast.fields) {
		document[field.name.value] = fromLiteral(field.value, variables, depth + 1);
	}

	return document;
}
