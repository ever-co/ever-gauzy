// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { HttpException, HttpStatus } from '@nestjs/common';
import { CLS_ID, ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { ExtractJwt } from 'passport-jwt';
import { JsonWebTokenError, verify } from 'jsonwebtoken';
import { IUser, PermissionsEnum, LanguagesEnum, RolesEnum, ID } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { SerializedRequestContext } from './types';

export class RequestContext {
	protected static clsService: ClsService;
	private static loggingEnabled: boolean = false;

	private readonly _id: ID;
	private readonly _res: Response;
	private readonly _req: Request;
	private readonly _languageCode: LanguagesEnum;

	/**
	 * Gets the language code.
	 *
	 * @returns The language code.
	 */
	get languageCode(): LanguagesEnum {
		return this._languageCode;
	}

	/**
	 * Gets the id.
	 *
	 * @returns The id.
	 */
	get id(): ID {
		return this._id;
	}

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
		id?: ID;
		req?: Request;
		res?: Response;
		languageCode?: LanguagesEnum;
		isAuthorized?: boolean;
	}) {
		// Set the context ID
		const contextId = options.id || uuidv4(); // If 'id' is not provided, generate a random ID.
		RequestContext.setContextId(contextId);

		// Assign values to instance properties.
		this._id = contextId;
		this._req = options.req;
		this._res = options.res;
		this._languageCode = options.languageCode;

		if (RequestContext.loggingEnabled) {
			console.log('RequestContext: setting context with generated Id:', RequestContext.getContextId());
		}
	}

	/**
	 * Static method to set the context ID in the ClsService.
	 *
	 * @param cls The ClsService instance used to set the context ID.
	 * @param id The ID to set in the ClsService context.
	 */
	public static setContextId(id: ID): void {
		// Check if the ClsService is available
		if (RequestContext.clsService) {
			RequestContext.clsService.set(CLS_ID, id);
		}
	}

	/**
	 * Static method to get the context ID from the ClsService.
	 *
	 * @param cls The ClsService instance used to retrieve the context ID.
	 * @returns The context ID or undefined if not set.
	 */
	public static getContextId(): ID | undefined {
		// Check if the ClsService is available
		if (RequestContext.clsService) {
			return RequestContext.clsService.get(CLS_ID);
		}
	}

	/**
	 * Sets the ClsService instance to be used by RequestContext.
	 *
	 * @param service - The ClsService instance to set.
	 */
	static setClsService(service: ClsService) {
		RequestContext.clsService = service;
	}

	/**
	 * Gets the current request context.
	 *
	 * @returns The current RequestContext instance.
	 */
	static currentRequestContext(): RequestContext {
		// Log if logging is enabled
		if (RequestContext.loggingEnabled) {
			console.log('RequestContext: retrieving context...');
		}

		// Retrieve the context from the ClsService
		const context = RequestContext.clsService?.get(RequestContext.name);

		// Log context ID if logging is enabled
		if (RequestContext.loggingEnabled) {
			console.log('RequestContext: context retrieved with ID:', context?.id);
		}

		return context;
	}

	/**
	 * Deserializes a serialized request context object into a RequestContext instance.
	 *
	 * @param ctxObject - The serialized request context object.
	 * @returns A new RequestContext instance.
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
	 * Gets the current request.
	 *
	 * @returns The current Request object or null if no context is available.
	 */
	static currentRequest(): any {
		return RequestContext.currentRequestContext()?._req || null;
	}

	/**
	 * Retrieves the current tenant ID associated with the user in the RequestContext.
	 * Returns the tenant ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current tenant ID or null if not available.
	 */
	static currentTenantId(): ID | null {
		const user: IUser | null = RequestContext.currentUser();
		return user?.tenantId || null;
	}

	/**
	 * Retrieves the current user ID associated with the user in the RequestContext.
	 * Returns the user ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current user ID or null if not available.
	 */
	static currentUserId(): ID | null {
		const user: IUser | null = RequestContext.currentUser();
		return user?.id || null;
	}

	/**
	 * Retrieves the current role ID associated with the user in the RequestContext.
	 * Returns the role ID if available, otherwise returns null.
	 *
	 * @returns {string | null} - The current role ID or null if not available.
	 */
	static currentRoleId(): ID | null {
		const user: IUser | null = RequestContext.currentUser();
		return user?.roleId || null;
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

	/**
	 * Checks if the current request context has the specified permissions.
	 *
	 * @param permissions - An array of permissions to check.
	 * @param throwError - Whether to throw an error if permissions are not found.
	 * @returns True if the required permissions are found, otherwise false.
	 */
	static hasPermissions(permissions: PermissionsEnum[], throwError?: boolean): boolean {
		const requestContext = RequestContext.currentRequestContext();
		if (requestContext) {
			try {
				// tslint:disable-next-line
				const token = this.currentToken();
				if (token) {
					const jwtPayload = verify(token, env.JWT_SECRET) as {
						id: string;
						permissions: PermissionsEnum[];
					};
					return permissions.every((permission: PermissionsEnum) =>
						(jwtPayload.permissions ?? []).includes(permission)
					);
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

	/**
	 * Checks if the current request context has any of the specified permissions.
	 *
	 * @param permissions - An array of permissions to check.
	 * @param throwError - Whether to throw an error if no permissions are found.
	 * @returns True if any of the required permissions are found, otherwise false.
	 */
	static hasAnyPermission(permissions: PermissionsEnum[], throwError?: boolean): boolean {
		const requestContext = RequestContext.currentRequestContext();
		if (requestContext) {
			try {
				// tslint:disable-next-line
				const token = this.currentToken();
				if (token) {
					const jwtPayload = verify(token, env.JWT_SECRET) as {
						id: string;
						permissions: PermissionsEnum[];
					};
					return (jwtPayload.permissions ?? []).some((permission) => permissions.includes(permission));
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

	/**
	 * Extracts the current JWT token from the request context.
	 *
	 * @param throwError - Whether to throw an error if no token is found.
	 * @returns The extracted token if found, otherwise null.
	 */
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

	/**
	 * Checks if the current request context has any of the specified roles.
	 *
	 * @param roles - An array of roles to check.
	 * @param throwError - Whether to throw an error if no roles are found.
	 * @returns True if any of the required roles are found, otherwise false.
	 */
	static hasRoles(roles: RolesEnum[], throwError?: boolean): boolean {
		const context = RequestContext.currentRequestContext();
		if (context) {
			try {
				// tslint:disable-next-line
				const token = this.currentToken();
				if (token) {
					const { role } = verify(token, env.JWT_SECRET) as { id: string; role: RolesEnum };
					return roles.includes(role ?? null);
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
