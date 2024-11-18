import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ID } from '@gauzy/contracts';
import { RequestContext } from './request-context';

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
			const correlationId = req.headers['x-correlation-id'] as ID; // Retrieve the correlation ID from the request headers
			const id = correlationId ?? uuidv4(); // If no correlation ID is provided, generate a new one

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
