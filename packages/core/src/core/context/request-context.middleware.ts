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
			console.log('RequestContextMiddleware: setting context ...');
			next();
		});
	}
}
