import { ASTNode, GraphQLError } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';

/**
 * The two ways a scalar fails, each in the envelope the error formatter passes through untouched.
 *
 * A value a caller sent is the caller's mistake and carries the catalogued validation code the REST
 * surface uses for the same class of mistake, so a client branches on one table rather than two. A
 * value the server is about to send is the server's defect and is reported as one.
 */

/**
 * The refusal of a value a caller sent.
 *
 * @param message What the caller has to fix. It never repeats a whole value back.
 * @param node The literal the refusal is about, so the error carries its location in the document.
 * @returns The error to throw.
 */
export function scalarInputRefusal(message: string, node?: ASTNode): GraphQLError {
	return new GraphQLError(message, {
		...(node ? { nodes: node } : {}),
		extensions: { code: ApiErrorCode.VALIDATION_FAILED, status: 400 }
	});
}

/**
 * The failure to serve a value the server holds.
 *
 * @param message What was wrong, without the value itself.
 * @returns The error to throw.
 */
export function scalarOutputFailure(message: string): GraphQLError {
	return new GraphQLError(message, {
		extensions: { code: ApiErrorCode.INTERNAL_ERROR, status: 500 }
	});
}

/**
 * Names a value's kind for a message, without printing the value itself.
 *
 * @param value The value.
 * @returns The kind, as a caller-facing noun.
 */
export function describeKind(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'list';
	if (value instanceof Date) return 'date';
	if (typeof value === 'number' && !Number.isFinite(value)) return 'non-finite number';

	return typeof value;
}
