import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@gauzy/contracts';
import { isEmpty, ROLES_METADATA } from '@gauzy/common';
import { RequestContext } from './../../core/context';

@Injectable()
export class RoleGuard implements CanActivate {

	constructor(
		private readonly _reflector: Reflector
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		/*
		* Retrieve metadata for a specified key for a specified set of roles
		*/
		const roles = this._reflector.getAllAndOverride<RolesEnum[]>(ROLES_METADATA, [
			context.getHandler(),
			context.getClass(),
		]) || [];
		let isAuthorized = false;
		if (isEmpty(roles)) {
			isAuthorized = true;
		} else {
			isAuthorized = RequestContext.hasRoles(roles);
		}
		return isAuthorized;
	}
}
