import { Injectable, CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@gauzy/contracts';
import { isEmpty, ROLES_METADATA } from '@gauzy/common';
import { RequestContext } from './../../core/context';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly _reflector: Reflector) {}

	/**
	 * Determines if the user associated with the request has the required roles.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether the user has the required roles.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		console.log('RoleGuard canActivate called');

		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];

		/*
		 * Retrieve metadata for a specified key for a specified set of roles
		 */
		const roles = this._reflector.getAllAndOverride<RolesEnum[]>(ROLES_METADATA, targets) || [];

		// Check if roles are empty or if the request context has the required roles
		const check = isEmpty(roles) || RequestContext.hasRoles(roles);

		console.log('Guard: Role', roles, check);

		return check;
	}
}
