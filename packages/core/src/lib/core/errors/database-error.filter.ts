import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { describeDatabaseError, isDatabaseErrorPayload, safeMessageForDatabaseText } from './database-error';

/**
 * Keeps database internals out of HTTP responses.
 *
 * ~120 sites across the API re-throw a caught ORM error as `new BadRequestException(error)`, and
 * Nest serializes that object's ENUMERABLE properties — which on a TypeORM `QueryFailedError` are
 * exactly `query`, `parameters` and `driverError`. A further ~160 throw `error.message`, which is
 * the driver's own text and names tables, columns and constraints (and on MySQL, the offending
 * value). Fixing those one at a time leaves the next one to be written unguarded, so the guarantee
 * is enforced here as well, at the single point every HTTP error passes through.
 *
 * Everything that is not a database leak is delegated to {@link BaseExceptionFilter} — Nest's own
 * handler — rather than reimplemented, so response shapes stay byte-for-byte identical. That
 * matters more than it looks: `new HttpException('msg', 404).getResponse()` returns a bare string,
 * which Nest wraps as `{ statusCode, message }`, while `new BadRequestException('msg')` already
 * returns the full object. Replicating that by hand is how a filter quietly changes every error
 * response in the app.
 *
 * Only `HttpException` is caught. A raw error that never got wrapped still reaches Nest's default
 * handling and answers 500 `{"message":"Internal server error"}`, which leaks nothing.
 *
 * Status codes are never changed: a failed write stays 400, a conflict stays 409.
 */
@Catch(HttpException)
export class DatabaseErrorFilter extends BaseExceptionFilter {
	private readonly logger = new Logger(DatabaseErrorFilter.name);

	/**
	 * @param exception - The thrown HTTP exception.
	 * @param host - The arguments host for the current context.
	 */
	catch(exception: HttpException, host: ArgumentsHost): void {
		const payload = exception.getResponse();
		const safeMessage = this.resolveSafeMessage(payload);

		if (!safeMessage) {
			// Not a database leak — hand it to Nest's own handler untouched.
			super.catch(exception, host);
			return;
		}

		const status = exception.getStatus();
		const request = host.switchToHttp().getRequest();

		// The full error, with its stack, stays server-side where it is actually useful.
		this.logger.error(
			`Database error on ${request?.method ?? ''} ${request?.url ?? ''}`,
			exception.stack ?? JSON.stringify(payload)
		);

		// Rebuild the body around the safe message.
		//
		// The payload may only be SPREAD when it is an ordinary response body that merely happens to
		// carry driver text in `message`. When the payload IS the driver error, spreading it would
		// keep `query`/`parameters`/`driverError` and just add a polite message next to them — which
		// is the whole bug, restated. Those are replaced outright.
		const isDriverErrorItself = isDatabaseErrorPayload(payload);
		const body =
			!isDriverErrorItself && payload && typeof payload === 'object'
				? { ...(payload as Record<string, unknown>), message: safeMessage }
				: {
						statusCode: status,
						message: safeMessage,
						// Keep the reason phrase only if the original body actually had one.
						...(typeof (payload as { error?: unknown })?.error === 'string'
							? { error: (payload as { error: string }).error }
							: {})
					};

		super.catch(new HttpException(body, status), host);
	}

	/**
	 * The replacement message when the payload exposes the database, or undefined to leave it alone.
	 *
	 * @param payload - The exception's response payload.
	 */
	private resolveSafeMessage(payload: unknown): string | undefined {
		// Shape 1: the driver error object itself (`query` / `parameters` / `driverError`).
		if (isDatabaseErrorPayload(payload)) {
			return describeDatabaseError(payload);
		}

		// Shape 2: a plain string, from the sites that throw `error.message`.
		if (typeof payload === 'string') {
			return safeMessageForDatabaseText(payload);
		}

		// Shape 3: a normal Nest body whose `message` is the driver's text.
		if (payload && typeof payload === 'object') {
			const { message } = payload as { message?: unknown };
			if (isDatabaseErrorPayload(message)) {
				return describeDatabaseError(message);
			}
			return safeMessageForDatabaseText(message);
		}

		return undefined;
	}
}
