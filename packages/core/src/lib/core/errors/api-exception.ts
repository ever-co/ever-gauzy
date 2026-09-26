import { HttpException } from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { ApiErrorCode } from './api-error-codes';

/**
 * An HTTP error that names its machine-readable code.
 *
 * The body it carries is the SAME three-key shape Nest produces for every other `HttpException`
 * — `{ statusCode, error, message }` — and that is deliberate rather than incidental: an
 * `ApiException` thrown from a route that has no filter, or observed by a test that calls the
 * service directly, already answers with the shape every existing client parses. The envelope the
 * filter adds (`code`, `details`, `timestamp`, `path`, `traceId`) is therefore strictly
 * field-additive, and a client that only knows the three original keys cannot tell the difference.
 *
 * `details` is the one place a caller may put structured information a client branches on — the
 * field a validation failure was about, the expected and actual version, the limit and the value
 * that exceeded it. It is written by the throw site, never derived from a caught error object:
 * an ORM error, a provider response or a request object must not reach it, because the filter
 * renders `details` verbatim and never inspects it for anything unsafe.
 */
export class ApiException extends HttpException {
	/** The catalogued code a client branches on. */
	readonly code: ApiErrorCode;

	/** Structured, client-facing context for this failure. Never driver, transport or secret data. */
	readonly details?: Record<string, unknown>;

	/**
	 * @param status - The HTTP status the response carries. Never inferred from the code.
	 * @param code - A code from the catalogue.
	 * @param message - The human-facing message. Safe to reword; the code is not.
	 * @param details - Optional structured context, documented per code.
	 */
	constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
		// The HttpException body is ALREADY the current three-key Nest shape, so the envelope is
		// field-additive even if the filter is never reached.
		super({ statusCode: status, error: reasonPhrase(status), message }, status);
		this.code = code;
		this.details = details;
	}
}

/**
 * The reason phrase Nest puts in an error body's `error` key — `'Not Found'` for 404, `'Conflict'`
 * for 409. It is Node's own table rather than a second copy of it, so a status this platform
 * returns reads exactly as it reads on every other `HttpException` in the application.
 *
 * @param status - The HTTP status.
 */
export function reasonPhrase(status: number): string {
	return STATUS_CODES[status] ?? 'Error';
}
