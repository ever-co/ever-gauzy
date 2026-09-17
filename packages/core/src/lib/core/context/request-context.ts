// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ID, IRole, IUser, LanguagesEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CLS_ID, ClsService } from 'nestjs-cls';
import { ExtractJwt } from 'passport-jwt';
import { v4 as uuidv4 } from 'uuid';
import { IAuthenticatedUser, SerializedRequestContext } from './types';

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
	 * Retrieves the current request's correlation id — TASK 9 (improvement roadmap, Unified
	 * Observability and Correlation IDs).
	 *
	 * This is the SAME value as {@link getContextId} (`RequestContextMiddleware` already sets it
	 * from an inbound `x-correlation-id` header, falling back to a generated UUID, and passes it
	 * as `RequestContext`'s own `id` — which the constructor also stores under this same CLS key).
	 * `currentCorrelationId()` exists so call sites that want "the id that ties this operation
	 * together across logs/queue jobs" don't need to know that `getContextId()`/`setContextId()`
	 * are the underlying storage — matching the naming of every other `current*` accessor here.
	 *
	 * `null` outside a request (e.g. on a queue worker thread, which never gets a `RequestContext`
	 * — see `packages/plugins/docs/src/lib/knowledge/queue/docs-job.types.ts`'s documented hard
	 * rule) rather than throwing, so a call site can use `?? undefined` unconditionally instead of
	 * a try/catch.
	 *
	 * @returns The current correlation id, or `null` if there is no active request context.
	 */
	static currentCorrelationId(): ID | null {
		return RequestContext.getContextId() ?? null;
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
	 * Retrieves the current organization ID from the request context.
	 *
	 * The organizationId is injected into user.lastOrganizationId by jwt.strategy.ts
	 * after validating that the user has access to the organization.
	 *
	 * @returns {ID | null} - The current organization ID or null if not available.
	 */
	static currentOrganizationId(): ID | null {
		const user: IUser | null = RequestContext.currentUser();
		return user?.lastOrganizationId || null;
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
	 * Retrieves the name of the role the current user holds, as loaded from the database for THIS
	 * request.
	 *
	 * `RegisterAuthorizationGuard` historically attached the role as a bare name, so both shapes are
	 * accepted here.
	 *
	 * @returns {RolesEnum | null} - The current role name, or null when the user has no resolvable role.
	 */
	static currentRoleName(): RolesEnum | null {
		const user: IAuthenticatedUser | null = RequestContext.currentUser();
		const role: IRole | RolesEnum | undefined = user?.role as IRole | RolesEnum | undefined;

		if (!role) {
			return null;
		}

		const name = typeof role === 'string' ? role : role.name;
		return (name as RolesEnum) || null;
	}

	/**
	 * Retrieves the enabled permissions of the current user's role, as loaded from the database for
	 * THIS request. Never the `permissions` claim of the access token.
	 *
	 * @returns {PermissionsEnum[]} - The granted permissions, or an empty array when none are known.
	 */
	static currentPermissions(): PermissionsEnum[] {
		const user: IAuthenticatedUser | null = RequestContext.currentUser();
		return Array.isArray(user?.permissions) ? user.permissions : [];
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
	 * @returns {IAuthenticatedUser | null} - The current user if found, otherwise null.
	 */
	static currentUser(throwError?: boolean): IAuthenticatedUser | null {
		const requestContext = RequestContext.currentRequestContext();

		// Check if request context exists
		if (requestContext) {
			// Get user from request context
			const user: IAuthenticatedUser = requestContext._req['user'];

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
	 * @param throwError - Whether to throw an HTTP 401 instead of returning `false`. This fires whenever the
	 *                     check fails — for an authenticated caller who simply lacks it, not only when no
	 *                     user is attached (the token-decoding implementation returned early for the former).
	 * @returns True if the required permissions are found, otherwise false.
	 */
	static hasPermissions(permissions: PermissionsEnum[], throwError?: boolean): boolean {
		// The permissions of the CURRENT role, attached to the request by JwtStrategy. Reading the
		// token's `permissions` claim instead would authorize against the permission set the role had
		// when the token was issued, which survives a demotion for the token's whole lifetime.
		const user: IUser | null = RequestContext.currentUser();

		if (user) {
			const granted = RequestContext.currentPermissions();

			if (permissions.every((permission: PermissionsEnum) => granted.includes(permission))) {
				return true;
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
	 * @param throwError - Whether to throw an HTTP 401 instead of returning `false`. This fires whenever the
	 *                     check fails — for an authenticated caller who simply lacks it, not only when no
	 *                     user is attached (the token-decoding implementation returned early for the former).
	 * @returns True if any of the required permissions are found, otherwise false.
	 */
	static hasAnyPermission(permissions: PermissionsEnum[], throwError?: boolean): boolean {
		// Database-fresh permissions, for the same reason as `hasPermissions()` above.
		const user: IUser | null = RequestContext.currentUser();

		if (user) {
			const granted = RequestContext.currentPermissions();

			if (granted.some((permission: PermissionsEnum) => permissions.includes(permission))) {
				return true;
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
	 * @param throwError - Whether to throw an HTTP 401 instead of returning `false`. This fires whenever the
	 *                     check fails — for an authenticated caller who simply lacks it, not only when no
	 *                     user is attached (the token-decoding implementation returned early for the former).
	 * @returns True if any of the required roles are found, otherwise false.
	 */
	static hasRoles(roles: RolesEnum[], throwError?: boolean): boolean {
		// The role the user holds RIGHT NOW, not the `role` claim baked into their access token: a
		// demoted user kept their former role — and everything RoleGuard, TenantPermissionGuard and
		// OrganizationPermissionGuard grant on the strength of it — until that token expired.
		const role: RolesEnum | null = RequestContext.currentRoleName();

		if (role && roles.includes(role)) {
			return true;
		}

		if (throwError) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}
		return false;
	}

	/**
	 * Checks if ip address is available in the request context and returns it, otherwise returns 'unknown-ip'.
	 * @returns {string} - The IP address from the request context or 'unknown-ip' if not available.
	 */
	static currentIp(): string {
		const requestContext = RequestContext.currentRequestContext();
		if (requestContext) {
			const req = requestContext._req;
			return (
				(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
				req.connection?.remoteAddress ||
				req.socket?.remoteAddress ||
				'unknown-ip'
			);
		}
		return 'unknown-ip';
	}

	/**
	 * Checks if user agent is available in the request context and returns it, otherwise returns 'unknown-user-agent'.
	 * @returns {string} - The user agent from the request context or 'unknown-user-agent' if not available.
	 */
	static currentUserAgent(): string {
		const requestContext = RequestContext.currentRequestContext();
		if (requestContext) {
			return requestContext._req.headers['user-agent'] || 'unknown-user-agent';
		}
		return 'unknown-user-agent';
	}
}
