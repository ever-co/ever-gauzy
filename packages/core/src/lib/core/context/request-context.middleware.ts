import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ID } from '@gauzy/contracts';
import { RequestContext } from './request-context';

/**
 * A trusted inbound `x-correlation-id` is echoed back verbatim and later interpolated into log
 * lines (this middleware's own, and `packages/plugins/docs`'s queue logs) — an unvalidated value
 * is a log-injection vector (CWE-117: a client-supplied `\n` could forge additional log lines) and
 * a header-injection one (a raw CR/LF could smuggle extra response headers). Correlation ids this
 * app generates are UUIDv4, so a generous but bounded allowlist (word characters and hyphens,
 * capped well above a UUID's 36 characters for interop with whatever format an upstream
 * proxy/load balancer already uses) rejects control characters and unbounded input while still
 * accepting any realistic legitimate value.
 */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	private readonly logger = new Logger(RequestContextMiddleware.name);
	private readonly loggingEnabled = true;

	constructor(private readonly clsService: ClsService) {}

	/**
	 * Middleware to manage request context and log request lifecycle.
	 *
	 * This middleware generates a `RequestContext` for each incoming request,
	 * logs the start and end of the request if logging is enabled, and ensures that
	 * the context is preserved during the request lifecycle using `nestjs-cls`.
	 *
	 * @param req The incoming HTTP request.
	 * @param res The outgoing HTTP response.
	 * @param next The next middleware function in the request-response cycle.
	 */
	use(req: Request, res: Response, next: NextFunction) {
		// Start a new context using the ClsService
		this.clsService.run(() => {
			const inboundCorrelationId = req.headers['x-correlation-id'] as ID | undefined;
			// A malformed/oversized/control-character-bearing value is treated the same as absent
			// (generate one) rather than rejecting the request — the header is advisory, and this is
			// the same fail-safe posture as trusting it at all in the first place.
			const id =
				typeof inboundCorrelationId === 'string' && SAFE_CORRELATION_ID.test(inboundCorrelationId)
					? inboundCorrelationId
					: uuidv4();

			// Echo it back (TASK 9 — Unified Observability and Correlation IDs): previously this id
			// was only ever readable server-side (via RequestContext.getContextId(), now also
			// RequestContext.currentCorrelationId()). Without this header, a caller that did NOT send
			// its own `x-correlation-id` had no way to learn the one the server generated, so it could
			// never hand that id to support/logs to correlate its own request with server-side logs.
			res.setHeader('x-correlation-id', String(id));

			const context = new RequestContext({ id, req, res });
			this.clsService.set(RequestContext.name, context);

			// Build the full request URL
			const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

			// Log the start of the request if logging is enabled
			if (this.loggingEnabled) {
				const contextId = RequestContext.getContextId();
				this.logger.log(`Context ${contextId}: ${req.method} request to ${fullUrl} started.`);
			}

			// Capture the original res.end function
			const originalEnd = res.end.bind(res);

			// Override the res.end function to log when the response finishes
			res.end = (...args: any[]): Response => {
				if (this.loggingEnabled) {
					const contextId = RequestContext.getContextId();
					this.logger.log(
						`Context ${contextId}: ${req.method} request to ${fullUrl} completed with status ${res.statusCode}.`
					);
				}

				// Call the original res.end and return its result
				return originalEnd(...args);
			};

			next();
		});
	}
}
