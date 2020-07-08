// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { HttpException, HttpStatus } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { User, PermissionsEnum } from '@gauzy/models';
import { ExtractJwt } from 'passport-jwt';
import { verify } from 'jsonwebtoken';
import { environment as env } from '@env-api/environment';

export class RequestContext {
	readonly id: number;
	request: Request;
	response: Response;

	constructor(request: Request, response: Response) {
		this.id = Math.random();
		this.request = request;
		this.response = response;
	}

	static currentRequestContext(): RequestContext {
		const session = cls.getNamespace(RequestContext.name);
		if (session && session.active) {
			return session.get(RequestContext.name);
		}

		return null;
	}

	static currentRequest(): Request {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			return requestContext.request;
		}

		return null;
	}

	static currentUser(throwError?: boolean): User {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			const user: User = requestContext.request['user'];

			if (user) {
				return user;
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return null;
	}

	static hasPermission(
		permission: PermissionsEnum,
		throwError?: boolean
	): boolean {
		return this.hasPermissions([permission], throwError);
	}

	static hasPermissions(
		findPermissions: PermissionsEnum[],
		throwError?: boolean
	): boolean {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			const token = ExtractJwt.fromAuthHeaderAsBearerToken()(
				requestContext.request as any
			);

			if (token) {
				const { permissions } = verify(token, env.JWT_SECRET) as {
					id: string;
					permissions: PermissionsEnum[];
				};
				if (permissions) {
					const found = permissions.filter(
						(value) => findPermissions.indexOf(value) >= 0
					);

					if (found.length === findPermissions.length) {
						return true;
					}
				} else {
					return false;
				}
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}
		return false;
	}

	static hasAnyPermission(
		findPermissions: PermissionsEnum[],
		throwError?: boolean
	): boolean {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			const token = ExtractJwt.fromAuthHeaderAsBearerToken()(
				requestContext.request as any
			);

			if (token) {
				const { permissions } = verify(token, env.JWT_SECRET) as {
					id: string;
					permissions: PermissionsEnum[];
				};
				const found = permissions.filter(
					(value) => findPermissions.indexOf(value) >= 0
				);
				if (found.length > 0) {
					return true;
				}
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}
		return false;
	}

	static currentToken(throwError?: boolean): any {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			return ExtractJwt.fromAuthHeaderAsBearerToken()(
				requestContext.request as any
			);
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}
		return null;
	}
}
