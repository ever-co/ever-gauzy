import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ObjectValueNode, ValueNode } from 'graphql';
import { scalarInputRefusal } from './scalar-errors';

/**
 * The name the kernel schema declares this scalar under.
 */
export const JSON_SCALAR_NAME = 'JSON';

/**
 * How deep a literal document may nest.
 *
 * A `JSON` literal is written by the caller and walked by the server, so an arbitrarily deep one is an
 * arbitrarily deep recursion. The bound is generous — a settings document, an event payload and a
 * metadata bag are all far below it — and a document that needs more is a mistake or an attack, for
 * which a refusal naming the limit is the honest answer.
 */
export const JSON_LITERAL_MAX_DEPTH = 32;

/**
 * A document column, carried through unchanged.
 *
 * `scalar JSON` was declared in `schema/common.type.gql` and implemented nowhere. The output half of an
 * unimplemented scalar happens to be right — a pass-through is what a document wants — and so is most
 * of the input half: a variable is JSON by construction, and graphql-js reads a literal with
 * `valueFromASTUntyped`, which builds prototype-free objects. What it does not have is a depth bound,
 * which is the one thing this implementation adds.
 *
 * Everything else about the value is deliberately untouched. A document column is the one place on
 * this surface where the platform has no opinion about shape, and a scalar that normalised it would be
 * changing data on its way through.
 */
@Scalar(JSON_SCALAR_NAME)
export class JsonScalar implements CustomScalar<unknown, unknown> {
	/**
	 * The description the SDL declares for the scalar, word for word: the driver copies a scalar class's
	 * description over the SDL's, so a different text here would be a schema the snapshot does not show.
	 */
	description = 'An arbitrary JSON document, carried through unchanged.';

	/**
	 * Reads a value the client sent in a variable. A variable has already been through `JSON.parse`,
	 * so it is a JSON value by construction and is returned as it stands.
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
 * Reads one node of a literal document, the way `valueFromASTUntyped` does, with a depth bound.
 *
 * @param ast The node.
 * @param variables The operation's variables.
 * @param depth How deep this node sits.
 * @returns The value the node describes.
 * @throws GraphQLError `VALIDATION_FAILED` below the depth bound.
 */
function fromLiteral(ast: ValueNode, variables: Record<string, unknown> | null, depth: number): unknown {
	if (depth > JSON_LITERAL_MAX_DEPTH) {
		throw scalarInputRefusal(`A JSON literal may not nest deeper than ${JSON_LITERAL_MAX_DEPTH} levels.`, ast);
	}

	switch (ast.kind) {
		case Kind.STRING:
		case Kind.BOOLEAN:
		case Kind.ENUM:
			// An enum literal has no JSON counterpart; its name is the value, which is the reading
			// `valueFromASTUntyped` gives it.
			return ast.value;
		case Kind.INT:
			return Number.parseInt(ast.value, 10);
		case Kind.FLOAT:
			return Number.parseFloat(ast.value);
		case Kind.NULL:
			return null;
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
 * The result is built from `Object.create(null)`, as `valueFromASTUntyped` builds it, so a document
 * carrying a `__proto__` member is a document with a member of that name rather than an object whose
 * prototype a caller chose.
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
