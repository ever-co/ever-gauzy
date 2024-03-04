// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { HttpException, HttpStatus } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { Request, Response } from 'express';
import { ExtractJwt } from 'passport-jwt';
import { JsonWebTokenError, verify } from 'jsonwebtoken';
import { IUser, PermissionsEnum, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/common';
import { SerializedRequestContext } from './types';

export class RequestContext {

	protected readonly _id: number;
	protected readonly _res: Response;
	private readonly _req: Request;
	private readonly _languageCode: LanguagesEnum;

	/**
	 * Constructor for the SampleClass.
	 * @param options - An object containing optional parameters for initializing the instance.
	 * @param options.id - Optional ID number for the instance. If not provided, a random ID is generated.
	 * @param options.req - Optional Request object.
	 * @param options.res - Optional Response object.
	 * @param options.languageCode - Optional language code (enum) for the instance.
	 */
	constructor(options: {
		id?: number;
		req?: Request;
		res?: Response;
		languageCode?: LanguagesEnum;
		isAuthorized?: boolean;
	}) {
		// Destructure options to extract individual properties.
		const { req, res, id, languageCode } = options;

		// If 'id' is not provided, generate a random ID.
		this._id = id || Math.random();

		// Assign values to instance properties.
		this._req = req;
		this._res = res;
		this._languageCode = languageCode;
	}

	/**
	 *
	 * @param ctx
	 * @returns
	 */
	static deserialize(ctxObject: SerializedRequestContext): RequestContext {
		return new RequestContext({
			req: ctxObject._req,
			languageCode: ctxObject._languageCode,
		});
	}

	/**
	 * Creates a shallow copy of the current instance of the RequestContext class.
	 * @returns A new instance of RequestContext with the same property values as the original.
	 */
	copy(): RequestContext {
		// Create a new object with the same prototype as the current instance
		// and copy the properties of the current instance to the new object
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}

	/**
	 *
	 */
	get languageCode(): LanguagesEnum {
		return this._languageCode;
	}

	/**
	 *
	 * @returns
	 */
	static currentRequestContext(): RequestContext {
		const session = cls.getNamespace(RequestContext.name);
		if (session && session.active) {
			return session.get(RequestContext.name);
		}
		return null;
	}

	/**
	 *
	 * @returns
	 */
	static currentRequest(): Request {
		const requestContext = RequestContext.currentRequestContext();
		if (requestContext) {
			return requestContext._req;
		}
		return null;
	}

	/**
	 * Retrieves the current tenant ID associated with the user in the RequestContext.
	 * Returns the tenant ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current tenant ID or null if not available.
	 */
	static currentTenantId(): string | null {
		try {
			const user: IUser | null = RequestContext.currentUser();
			return user ? user.tenantId : null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Retrieves the current user ID associated with the user in the RequestContext.
	 * Returns the user ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current user ID or null if not available.
	 */
	static currentUserId(): string | null {
		try {
			const user: IUser | null = RequestContext.currentUser();
			return user ? user.id : null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Retrieves the current role ID associated with the user in the RequestContext.
	 * Returns the role ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current role ID or null if not available.
	 */
	static currentRoleId(): string | null {
		try {
			const user: IUser | null = RequestContext.currentUser();
			return user ? user.roleId : null;
		} catch (error) {
			return null;
		}
	}

	/**
	 *
	 * @returns
	 */
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

	/**
	 *
	 * @param throwError
	 * @returns
	 */
	static currentUser(throwError?: boolean): IUser {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			// tslint:disable-next-line
			const user: IUser = requestContext._req['user'];

			if (user) {
				return user;
			}
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return null;
	}

	/**
	 *
	 * @param permission
	 * @param throwError
	 * @returns
	 */
	static hasPermission(permission: PermissionsEnum, throwError?: boolean): boolean {
		return this.hasPermissions([permission], throwError);
	}

	/**
	 * Retrieves the language code from the headers of the current request.
	 * @returns The language code (LanguagesEnum) extracted from the headers, or the default language (ENGLISH) if not found.
	 */
	static getLanguageCode(): LanguagesEnum {
		// Retrieve the current request
		const req = RequestContext.currentRequest();

		// Variable to store the extracted language code
		let lang: LanguagesEnum;

		// Check if a request exists
		if (req) {
			// Check if the 'language' header exists in the request
			if (req.headers && req.headers['language']) {
				// If found, set the lang variable
				lang = req.headers['language'] as LanguagesEnum;
			}
		}

		// Return the extracted language code or the default language (ENGLISH) if not found
		return lang || LanguagesEnum.ENGLISH;
	}


	static hasPermissions(findPermissions: PermissionsEnum[], throwError?: boolean): boolean {
		const requestContext = RequestContext.currentRequestContext();

		if (requestContext) {
			try {
				// tslint:disable-next-line
				const token = ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext._req as any);

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
				const token = ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext._req as any);

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
				return ExtractJwt.fromAuthHeaderAsBearerToken()(requestContext._req as any);
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
