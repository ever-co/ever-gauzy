import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isJSON } from 'class-validator';
import { RequestContext } from '../../../core/context';
import { RequestMethodEnum, RolesEnum } from '@gauzy/models';
import { TenantService } from '../../../tenant/tenant.service';

@Injectable()
export class TenantPermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly tenantService: TenantService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { id, tenantId } = RequestContext.currentUser();
		const currentTenantId = tenantId;
		const request: any = context.switchToHttp().getRequest();
		const method: any = request.method;

		let isAuthorized = false;
		if (!currentTenantId) {
			return isAuthorized;
		}

		//if request to get data using another tenantId then reject request.
		if (RequestMethodEnum.GET === method) {
			if (request.query.hasOwnProperty('data')) {
				const query: any = request.query.data;
				const isJson = isJSON(query);
				if (isJson) {
					try {
						const parse = JSON.parse(query);
						//Match provided tenantId with logged in tenantId
						if (
							'findInput' in parse &&
							'tenantId' in parse['findInput']
						) {
							const findTenantId = parse['findInput']['tenantId'];
							//We will use tenantId from headers in future
							// const findTenantId = request.headers.TenantId;
							isAuthorized = currentTenantId === findTenantId;
							//if tenantId not matched reject request
							if (!isAuthorized) {
								return false;
							}
						}
					} catch (e) {
						console.log('Json Parser Error:', e);
						return isAuthorized;
					}
				}
			}

			if ('tenantId' in request.query) {
				const findTenantId = request.query['tenantId'];
				//We will use tenantId from headers in future
				// const findTenantId = request.headers.TenantId;
				isAuthorized = currentTenantId === findTenantId;
				//if tenantId not matched reject request
				if (!isAuthorized) {
					return false;
				}
			}
		}

		//if request to save/update data using another tenantId then reject request.
		const payload = [RequestMethodEnum.POST, RequestMethodEnum.PUT];
		if (payload.includes(method)) {
			const body: any = request.body;
			//We will use tenantId from headers in future
			// const bodyTenantId = request.headers.TenantId;

			if ('tenantId' in body) {
				const bodyTenantId = body['tenantId'];
				isAuthorized = currentTenantId === bodyTenantId;
				//if tenantId not matched reject request
				if (!isAuthorized) {
					return false;
				}
			}

			if ('tenant' in body) {
				const bodyTenantId = body['tenant']['id'];
				isAuthorized = currentTenantId === bodyTenantId;
				//if tenantId not matched reject request
				if (!isAuthorized) {
					return false;
				}
			}
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
			const tenant = await this.tenantService.findOne(currentTenantId, {
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
