import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { TenantService } from './../../tenant/tenant.service';
import { TenantBaseGuard } from './tenant-base.guard';

@Injectable()
export class TenantPermissionGuard
	extends TenantBaseGuard
	implements CanActivate {
	constructor(
		protected readonly reflector: Reflector,
		private readonly tenantService: TenantService
	) {
		super(reflector);
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const currentTenantId = RequestContext.currentTenantId();
		let isAuthorized = false;
		if (!currentTenantId) {
			return isAuthorized;
		}

		// Basically if this guard is true then try the check tenant permissions.
		isAuthorized = await super.canActivate(context);
		if (!isAuthorized) {
			return isAuthorized;
		}

		//Enabled AllowSuperAdminRole from .env file
		if (env.allowSuperAdminRole === true) {
			//Super admin and admin has allowed to access request
			const isSuperAdmin = RequestContext.hasRoles([
				RolesEnum.SUPER_ADMIN
			]);
			if (isSuperAdmin === true) {
				isAuthorized = isSuperAdmin;
				return isAuthorized;
			}
		}

		/*
		* Permissions decorator method level 
		*/
		const methodPermissions = this.reflector.get<string[]>(
			'permissions',
			context.getHandler()
		) || [];

		/*
		* Permissions class method level 
		*/
		const classPermissions = this.reflector.get<string[]>(
			'permissions', 
			context.getClass()
		) || [];

		const permissions = removeDuplicates(methodPermissions.concat(classPermissions));		
		if (permissions.length > 0) {
			const tenant = await this.tenantService.findOneByIdString(currentTenantId, {
				relations: ['rolePermissions']
			});
			isAuthorized = !!tenant.rolePermissions.find(
				(p) => permissions.indexOf(p.permission) > -1 && p.enabled
			);
		}

		if (!isAuthorized) {
			console.log(
				'Unauthorized access blocked. TenantId:',
				currentTenantId,
				' Permissions Checked:',
				permissions
			);
		}
		return isAuthorized;
	}
}
