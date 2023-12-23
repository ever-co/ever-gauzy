import { Injectable, NestMiddleware } from '@nestjs/common';
import { Handlers } from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SentryRequestMiddleware implements NestMiddleware {
	private readonly handler = Handlers.requestHandler({
		include: {
			ip: true,
			user: true,
			request: true,
			transaction: 'methodPath'
		}
	});

	constructor() {}
	use(req: Request, res: Response, next: NextFunction): void {
		this.handler(req, res, next);
	}
}
