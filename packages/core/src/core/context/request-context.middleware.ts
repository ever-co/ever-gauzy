import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	constructor(private clsService: ClsService) {}

	use(req: Request, res: Response, next: NextFunction) {
		this.clsService.run(() => {
			const context = new RequestContext({ req, res });
			this.clsService.set(RequestContext.name, context);

			const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
			console.log(`Context ${context.id}. Request URL: ${fullUrl} started...`);

			// Capture the original res.end
			const originalEnd = res.end.bind(res);

			// Override res.end
			res.end = (...args: any[]): Response => {
				console.log(`Context ${context.id}. Request to ${fullUrl} completed.`);

				// Call the original res.end and return its result
				return originalEnd(...args);
			};

			next();
		});
	}
}
