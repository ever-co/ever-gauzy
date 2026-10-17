import { Injectable, CanActivate, ExecutionContext, Type, Logger } from '@nestjs/common';
import { ROLES_METADATA } from '@gauzy/constants';
import { RolesEnum } from '@gauzy/contracts';
import { Reflector } from '@nestjs/core';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';

// Per-request trace lines: printed at debug level, i.e. only when LOG_LEVEL is debug/verbose (or unset).
const logger = new Logger('RoleGuard');

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly _reflector: Reflector) {}

	/**
	 * Determines if the user associated with the request has the required roles.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether the user has the required roles.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		logger.debug('RoleGuard canActivate called');

		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];

		/*
		 * Retrieve metadata for a specified key for a specified set of roles
		 */
		const roles = this._reflector.getAllAndOverride<RolesEnum[]>(ROLES_METADATA, targets) || [];

		// Check if roles are empty or if the request context has the required roles
		const check = isEmpty(roles) || RequestContext.hasRoles(roles);

		logger.debug(`Guard: Role ${JSON.stringify(roles)} ${check}`);

		return check;
	}
}
