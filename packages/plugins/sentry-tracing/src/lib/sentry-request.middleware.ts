import { Injectable, NestMiddleware } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SentryRequestMiddleware implements NestMiddleware {
	constructor() {}

	/**
	 * Handles the request.
	 * V9 Migration: Handlers.requestHandler was removed, manual context setting
	 * Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/#behavior-changes
	 *
	 * @param {Request} req - The Express request object.
	 * @param {Response} res - The Express response object.
	 * @param {NextFunction} next - The Express next function.
	 */
	use(req: Request, res: Response, next: NextFunction): void {
		// V9 Migration: In Sentry v9, request handling is done automatically by the httpIntegration
		// We just need to set additional request context if needed
		Sentry.getCurrentScope().setContext('request', {
			method: req.method,
			url: req.url,
			headers: req.headers,
			query: req.query
		});

		// V9 Migration: Manual user context setting since requestDataIntegration no longer automatically sets user from request.user
		// Reference: https://docs.sentry.io/platforms/javascript/guides/node/migration/v8-to-v9/#behavior-changes
		if ((req as any).user) {
			Sentry.getCurrentScope().setUser((req as any).user);
		}

		next();
	}
}
