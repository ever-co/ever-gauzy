import { Injectable, NestMiddleware } from '@nestjs/common';
import { Handlers } from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SentryTraceMiddleware implements NestMiddleware {
	private readonly handler = Handlers.tracingHandler();

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	use(req: Request, res: Response, next: NextFunction): void {
		this.handler(req, res, next);
	}
}
