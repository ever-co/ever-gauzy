import { ApiErrorCode } from './api-error-codes';
import { ApiException, reasonPhrase } from './api-exception';

/**
 * The error body every surface returns, and the one function that renders it.
 *
 * `statusCode`, `error` and `message` keep the exact meaning and value they have on every existing
 * Gauzy error response; `code`, `details`, `timestamp`, `path` and `traceId` are added keys. A
 * client written against the three original keys therefore keeps working unchanged, and a client
 * that wants to branch on the failure rather than parse the sentence reads `code`.
 *
 * `traceId` is the id an operator quotes when a caller reports a failure. It is the same value the
 * log line for that request carries, so a ticket maps to a log record without the caller having to
 * send anything that identifies them.
 */
export interface ApiErrorBody {
	/** The HTTP status, unchanged from what the exception carries. */
	readonly statusCode: number;
	/** The status reason phrase — `'Conflict'` for 409. */
	readonly error: string;
	/** The human-facing message. May be reworded; `code` may not. */
	readonly message: string;
	/** The machine-readable code. */
	readonly code: ApiErrorCode;
	/** Structured context, present only when the throw site supplied it. */
	readonly details?: Record<string, unknown>;
	/** When the response was rendered, ISO-8601. */
	readonly timestamp: string;
	/** The path that was requested, including the query string. */
	readonly path: string;
	/** The trace (or at minimum correlation) id for this request. Empty if no context exists. */
	readonly traceId: string;
}

/** The parts of the request the envelope needs. Structural, so a test can pass a literal. */
export interface ApiErrorRequest {
	readonly originalUrl?: string;
	readonly url?: string;
}

/**
 * Renders an {@link ApiException} as the error body.
 *
 * The trace id is passed IN rather than read here: this module stays free of the request context,
 * so it can be exercised — and the envelope asserted key by key — without a running application.
 * The filter is the one place that knows how to resolve it.
 *
 * @param exception - The exception being rendered.
 * @param request - The request being answered, when there is one.
 * @param traceId - The trace id resolved for this request.
 */
export function toApiErrorBody(exception: ApiException, request?: ApiErrorRequest, traceId?: string): ApiErrorBody {
	const status = exception.getStatus();
	const response = exception.getResponse();
	const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : undefined;

	return {
		statusCode: status,
		error: typeof body?.error === 'string' ? body.error : reasonPhrase(status),
		message: typeof exception.message === 'string' ? exception.message : String(response ?? ''),
		code: exception.code,
		// Spread rather than assign, so a failure with no structured context does not carry an
		// empty `details` key that a client would have to treat as meaningful.
		...(exception.details ? { details: exception.details } : {}),
		timestamp: new Date().toISOString(),
		path: request?.originalUrl ?? request?.url ?? '',
		traceId: traceId ?? ''
	};
}
