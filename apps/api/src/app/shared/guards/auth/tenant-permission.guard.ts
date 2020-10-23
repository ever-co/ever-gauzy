import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../../../core/context';
import { RolesEnum } from '@gauzy/models';
import { TenantService } from '../../../tenant/tenant.service';

@Injectable()
export class TenantPermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly tenantService: TenantService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { id, tenantId: currentTenantId } = RequestContext.currentUser();

		//Get Tenant-ID from request headers
		const headerTenantId = context.switchToHttp().getRequest().headers[
			'tenant-id'
		];
		const rawHeaders = context.switchToHttp().getRequest().rawHeaders;

		let isAuthorized = false;
		if (!rawHeaders.includes('Tenant-ID')) {
			return isAuthorized;
		}
		if (!currentTenantId || !headerTenantId) {
			return isAuthorized;
		}

		isAuthorized = currentTenantId === headerTenantId;
		//if tenantId not matched reject request
		if (!isAuthorized) {
			return false;
		}

		//Super admin and admin has allowed to access request
		const isSuperAdmin = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN]);
		if (isSuperAdmin === true) {
			isAuthorized = isSuperAdmin;
			return isAuthorized;
		}

		//Check tenant permissions
		const permissions = this._reflector.get<string[]>(
			'permissions',
			context.getHandler()
		);
		if (permissions) {
			const tenant = await this.tenantService.findOne(headerTenantId, {
				relations: ['rolePermissions']
			});
			isAuthorized = !!tenant.rolePermissions.find(
				(p) => permissions.indexOf(p.permission) > -1 && p.enabled
			);
		}
		if (!isAuthorized) {
			console.log(
				'Unauthorized access blocked. UserId:',
				id,
				' Permissions Checked:',
				permissions
			);
		}
		return isAuthorized;
	}
}
