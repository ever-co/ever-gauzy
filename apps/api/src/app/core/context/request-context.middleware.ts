// Code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable, NestMiddleware } from '@nestjs/common';
import * as cls from 'cls-hooked';

import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req, res, next) {
    const requestContext = new RequestContext(req, res);
    const session = cls.getNamespace(RequestContext.name) || cls.createNamespace(RequestContext.name);

    session.run(async () => {
      session.set(RequestContext.name, requestContext);
      next();
    });
  }
}
