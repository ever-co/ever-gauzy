import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectSentry, SentryService } from './ntegral';
import { Handlers } from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SentryTraceMiddleware implements NestMiddleware {
	private readonly handler = Handlers.tracingHandler();

	constructor(@InjectSentry() private readonly sentry: SentryService) {}
	use(req: Request, res: Response, next: NextFunction): void {
		this.handler(req, res, next);
	}
}
