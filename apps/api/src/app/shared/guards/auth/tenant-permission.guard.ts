import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../../../core/context';
import { RolesEnum } from '@gauzy/models';
import { TenantService } from '../../../tenant/tenant.service';
import { environment as env } from '@env-api/environment';
import { TenantBaseGuard } from './tenant-base.guard ';
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
		const { tenantId: currentTenantId } = RequestContext.currentUser();
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

		//Check tenant permissions
		const permissions = this.reflector.get<string[]>(
			'permissions',
			context.getHandler()
		);
		if (permissions) {
			const tenant = await this.tenantService.findOne(currentTenantId, {
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
