// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable, NestMiddleware } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { Request, Response, NextFunction } from 'express';

import { RequestContext } from './request-context';

// There are few alternatives to 'cls-hooked', see:
// https://docs.nestjs.com/recipes/async-local-storage
// https://github.com/papooch/nestjs-cls

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		const requestContext = new RequestContext(req, res);
		const session = cls.getNamespace(RequestContext.name) || cls.createNamespace(RequestContext.name);

		// Note: this is "session" created by "cls-hooked" lib code,
		// not related to express "session" storage at all!
		// Also, session.run essentially creates unique context for each
		// request so all data is isolated without any potential conflicts
		// for concurrent requests
		session.run(async () => {
			session.set(RequestContext.name, requestContext);
			next();
		});
	}
}
