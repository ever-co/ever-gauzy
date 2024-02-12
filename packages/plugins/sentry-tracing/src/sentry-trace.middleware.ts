import { Injectable, NestMiddleware } from '@nestjs/common';
import { Handlers } from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SentryTraceMiddleware implements NestMiddleware {
	private readonly handler = Handlers.tracingHandler();

	/**
	 * Handles the request.
	 * @param {Request} req - The Express request object.
	 * @param {Response} res - The Express response object.
	 * @param {NextFunction} next - The Express next function.
	 */
	use(req: Request, res: Response, next: NextFunction): void {
		this.handler(req, res, next);
	}
}
