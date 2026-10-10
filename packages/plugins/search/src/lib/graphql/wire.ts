import { HttpException } from '@nestjs/common';

/**
 * The wire shapes a search mutation answers with.
 *
 * A mutation reports an outcome the caller could have avoided in `userErrors` while the operation
 * itself succeeds, and only a request that could not have been made correctly becomes a GraphQL
 * error. The code is taken from the exception's own message when the service named a platform code
 * and derived from the HTTP status otherwise, so a client sees one vocabulary across both surfaces.
 */

/** One expected, caller-correctable outcome of a mutation. */
export interface IUserError {
	code: string;
	message: string;
	path?: string[];
	details?: unknown;
}

/** The codes search raises that a client is expected to branch on. */
const KNOWN_CODES = [
	'SEARCH_QUERY_INVALID',
	'SEARCH_REINDEX_IN_PROGRESS',
	'SEARCH_INDEX_UNAVAILABLE',
	'SEARCH_FIELD_UNKNOWN',
	'SEARCH_INDEX_DEFINITION_NOT_FOUND'
];

/**
 * @param status An HTTP status.
 * @returns The stable code the GraphQL surface reports for it.
 */
function codeForStatus(status: number): string {
	switch (status) {
		case 400:
			return 'BAD_REQUEST';
		case 401:
			return 'UNAUTHENTICATED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 409:
			return 'CONFLICT';
		case 422:
			return 'UNPROCESSABLE_ENTITY';
		case 503:
			return 'SERVICE_UNAVAILABLE';
		default:
			return 'INTERNAL_ERROR';
	}
}

/**
 * @param error The error a service threw.
 * @returns The outcome a mutation payload carries.
 */
export function toUserError(error: unknown): IUserError {
	const message = error instanceof Error ? error.message : String(error);
	const named = KNOWN_CODES.find((code) => message.includes(code));
	const prefixed = /^([A-Z][A-Z0-9_]{3,}):/.exec(message)?.[1];
	const code =
		named ?? prefixed ?? (error instanceof HttpException ? codeForStatus(error.getStatus()) : 'INTERNAL_ERROR');

	return { code, message, path: [], details: null };
}
