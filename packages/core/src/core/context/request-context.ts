// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ExtractJwt } from 'passport-jwt';
import { JsonWebTokenError, verify } from 'jsonwebtoken';
import { IUser, PermissionsEnum, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/common';
import { SerializedRequestContext } from './types';
import { ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

export class RequestContext {
	protected readonly _id: string;
	protected readonly _res: Response;
	private readonly _req: Request;
	private readonly _languageCode: LanguagesEnum;

	/**
	 * Creates an instance of RequestContext.
	 * @param options - An object containing optional parameters for initializing the instance.
	 * @param options.id - Optional Request ID. If not provided, a random ID (UUID) is generated.
	 * @param options.req - Optional Request object.
	 * @param options.res - Optional Response object.
	 * @param options.languageCode - Optional language code (enum) for the instance.
	 * @param options.isAuthorized - Optional flag indicating whether the user is authorized.
	 */
	constructor(options: {
		id?: string;
		req?: Request;
		res?: Response;
		languageCode?: LanguagesEnum;
		isAuthorized?: boolean;
	}) {
		// Destructure options to extract individual properties.
		const { req, res, id, languageCode } = options;

		// If 'id' is not provided, generate a random ID.
		this._id = id || uuidv4().toString();

		console.log('RequestContext: setting context with Id:', this._id);

		// Assign values to instance properties.
		this._req = req;
		this._res = res;

		this._languageCode = languageCode;
	}

	protected static clsService: ClsService;

	static setClsService(service: ClsService) {
		RequestContext.clsService = service;
	}

	static currentRequestContext(): RequestContext {
		console.log('RequestContext: getting context ...');
		const context = RequestContext.clsService.get(RequestContext.name);
		console.log('RequestContext: got context with Id:', context?._id);
		return context;
	}

	/**
	 *
	 * @param ctx
	 * @returns
	 */
	static deserialize(ctxObject: SerializedRequestContext): RequestContext {
		return new RequestContext({
			req: ctxObject._req,
			languageCode: ctxObject._languageCode
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

	get id(): string {
		return this._id;
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
	 * Retrieves the current employee ID from the request context.
	 * @returns {string | null} - The current employee ID if available, otherwise null.
	 */
	static currentEmployeeId(): string | null {
		try {
			// Retrieve the current user from the request context
			const user: IUser = RequestContext.currentUser();

			// Check if the user is not empty and has the permission to change selected employee
			if (isNotEmpty(user) && RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				// Return null if the user has the permission to change selected employee
				return null;
			}

			// Return the user's employeeId if available
			return user?.employeeId || null;
		} catch (error) {
			// Return null if an error occurs
			return null;
		}
	}

	/**
	 * Retrieves the current user from the request context.
	 * @param {boolean} throwError - Flag indicating whether to throw an error if user is not found.
	 * @returns {IUser | null} - The current user if found, otherwise null.
	 */
	static currentUser(throwError?: boolean): IUser | null {
		const requestContext = RequestContext.currentRequestContext();

		// Check if request context exists
		if (requestContext) {
			// Get user from request context
			const user: IUser = requestContext._req['user'];

			// If user exists, return it
			if (user) {
				return user;
			}
		}

		// If throwError is true, throw an unauthorized error
		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		// If throwError is false or not provided, return null
		return null;
	}

	/**
	 * Checks if the current user has a specific permission.
	 * @param {PermissionsEnum} permission - The permission to check.
	 * @param {boolean} throwError - Flag indicating whether to throw an error if permission is not granted.
	 * @returns {boolean} - True if the user has the permission, otherwise false.
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

	/**
	 * Checks if the current user has a specific role.
	 * @param {RolesEnum} role - The role to check.
	 * @param {boolean} throwError - Flag indicating whether to throw an error if the role is not granted.
	 * @returns {boolean} - True if the user has the role, otherwise false.
	 */
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
