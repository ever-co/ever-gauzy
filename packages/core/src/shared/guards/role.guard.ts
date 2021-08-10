import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly _reflector: Reflector) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const roles = this._reflector.get<RolesEnum[]>(
			'roles',
			context.getHandler()
		);

		let isAuthorized = false;

		if (!roles) {
			isAuthorized = true;
		} else {
			isAuthorized = RequestContext.hasRoles(roles);
		}
		return isAuthorized;
	}
}
