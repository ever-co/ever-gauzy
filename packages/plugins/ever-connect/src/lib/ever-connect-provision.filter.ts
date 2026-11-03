import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { IntentRefusedError } from './services/ever-connect-intent-verifier.service';

const TITLES: Record<number, string> = {
	400: 'Bad Request',
	401: 'Unauthorized',
	404: 'Not Found',
	409: 'Conflict',
	422: 'Unprocessable Content',
	429: 'Too Many Requests',
	500: 'Internal Server Error'
};

/** The codes a body may carry; anything else is answered by its status alone. */
const CODES = new Set([
	'intent_invalid',
	'intent_expired',
	'intent_replayed',
	'identity_mismatch',
	'sign_in_required',
	'organization_already_linked',
	'provisioning_in_progress',
	'product_mismatch',
	'validation_failed',
	'terms_required',
	'rate_limited',
	'provisioning_failed',
	'not_found'
]);

/**
 * Answers every error of the workspace routes as an RFC 9457 problem (`application/problem+json`):
 * `{type, title, status, code}` and nothing else, so no detail of a refused request, no stack and no
 * e-mail address ever reaches the caller. A refused request is 401 `intent_invalid` (422
 * `product_mismatch` for another product's request); an unexpected error is 500 `provisioning_failed`.
 */
@Catch()
export class EverConnectProvisionExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger('EverConnect');

	catch(exception: unknown, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>();
		let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
		let code = 'provisioning_failed';
		if (exception instanceof IntentRefusedError) {
			status = exception.getStatus();
			code = exception.code;
		} else if (exception instanceof ThrottlerException) {
			status = HttpStatus.TOO_MANY_REQUESTS;
			code = 'rate_limited';
		} else if (exception instanceof HttpException) {
			status = exception.getStatus();
			const body = exception.getResponse() as { code?: unknown } | string;
			const named = typeof body === 'object' && typeof body?.code === 'string' ? body.code : null;
			code =
				named && CODES.has(named)
					? named
					: status === 404
						? 'not_found'
						: status === 429
							? 'rate_limited'
							: status === 400 || status === 422
								? 'validation_failed'
								: status === 401
									? 'intent_invalid'
									: 'provisioning_failed';
			if (status >= 500) {
				status = HttpStatus.INTERNAL_SERVER_ERROR;
				code = 'provisioning_failed';
			}
		} else {
			this.logger.warn('A workspace request failed unexpectedly.');
		}
		response
			.status(status)
			.setHeader('Content-Type', 'application/problem+json')
			.setHeader('Cache-Control', 'no-store')
			.send(
				JSON.stringify({
					type: status === 404 ? 'about:blank' : `https://ever.co/problems/${code}`,
					title: TITLES[status] ?? 'Error',
					status,
					code
				})
			);
	}
}
