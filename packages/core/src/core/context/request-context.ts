// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { HttpException, HttpStatus } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { Request, Response } from 'express';
import { IUser, PermissionsEnum, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { ExtractJwt } from 'passport-jwt';
import { JsonWebTokenError, verify } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/common';

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

	static currentTenantId(): string {
		try {
			const user: IUser = RequestContext.currentUser();
			return user.tenantId;
		} catch (error) {
			return null;
		}
	}

	static currentUserId(): string {
		try {
			const user: IUser = RequestContext.currentUser();
			if (user) {
				return user.id;
			}
			return null;
		} catch (error) {
			return null;
		}
	}

	static currentRoleId(): string {
		try {
			const user: IUser = RequestContext.currentUser();
			if (user) {
				return user.roleId;
			}
			return null;
		} catch (error) {
			return null;
		}
	}

	static currentEmployeeId(): string {
		try {
			const user: IUser = RequestContext.currentUser();
			if (isNotEmpty(user)) {
				if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					return user.employeeId;
				}
			}
			return null;
		} catch (error) {
			return null;
		}
	}

	static currentUser(throwError?: boolean): IUser {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			const user: IUser = requestContext.request['user'];

			if (user) {
				return user;
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return null;
	}

	static hasPermission(permission: PermissionsEnum, throwError?: boolean): boolean {
		return this.hasPermissions([permission], throwError);
	}

	static getLanguageCode(): LanguagesEnum {
		const req = this.currentRequest();
		let lang: LanguagesEnum;
		const keys = ['language'];
		if (req) {
			for (const key of keys) {
				if (req.headers && req.headers[key]) {
					lang = req.headers[key] as LanguagesEnum;
					break;
				}
			}
		}

		return lang;
	}

	static hasPermissions(findPermissions: PermissionsEnum[], throwError?: boolean): boolean {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			try {
				// tslint:disable-next-line
				const token = ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext.request as any);

				if (token) {
					const { permissions } = verify(token, env.JWT_SECRET) as {
						id: string;
						permissions: PermissionsEnum[];
					};
					if (permissions) {
						const found = permissions.filter((value) => findPermissions.indexOf(value) >= 0);

						if (found.length === findPermissions.length) {
							return true;
						}
					} else {
						return false;
					}
				}
			} catch (error) {
				// Do nothing here, we throw below anyway if needed
				console.log(error);
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return false;
	}

	static hasAnyPermission(findPermissions: PermissionsEnum[], throwError?: boolean): boolean {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			try {
				// tslint:disable-next-line
				const token = ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext.request as any);

				if (token) {
					const { permissions } = verify(token, env.JWT_SECRET) as {
						id: string;
						permissions: PermissionsEnum[];
					};
					const found = permissions.filter((value) => findPermissions.indexOf(value) >= 0);
					if (found.length > 0) {
						return true;
					}
				}
			} catch (error) {
				// Do nothing here, we throw below anyway if needed
				console.log(error);
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
			try {
				// tslint:disable-next-line
				return ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext.request as any);
			} catch (error) {
				// Do nothing here, we throw below anyway if needed
				console.log(error);
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return null;
	}

	static hasRole(role: RolesEnum, throwError?: boolean): boolean {
		return this.hasRoles([role], throwError);
	}

	static hasRoles(roles: RolesEnum[], throwError?: boolean): boolean {
		const context = RequestContext.currentRequestContext();
		if (context) {
			try {
				const token = this.currentToken();
				if (token) {
					const { role } = verify(token, env.JWT_SECRET) as {
						id: string;
						role: RolesEnum;
					};
					return role ? roles.includes(role) : false;
				}
			} catch (error) {
				if (error instanceof JsonWebTokenError) {
					return false;
				} else {
					throw error;
				}
			}
		}
		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}
		return false;
	}
}
