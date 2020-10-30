import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../../../core/context';
import { RequestMethodEnum, RolesEnum } from '@gauzy/models';
import { TenantService } from '../../../tenant/tenant.service';
import { isJSON } from 'class-validator';
import { environment as env } from '@env-api/environment';
@Injectable()
export class TenantPermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly tenantService: TenantService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { tenantId: currentTenantId } = RequestContext.currentUser();
		const request: any = context.switchToHttp().getRequest();
		const method: RequestMethodEnum = request.method;
		const query: any = request.query;

		let isAuthorized = false;
		if (!currentTenantId) {
			return isAuthorized;
		}

		//Get Tenant-ID from request headers
		const headerTenantId = context.switchToHttp().getRequest().headers[
			'tenant-id'
		];
		const rawHeaders = context.switchToHttp().getRequest().rawHeaders;
		if (
			headerTenantId &&
			(rawHeaders.includes('tenant-id') ||
				rawHeaders.includes('Tenant-ID'))
		) {
			isAuthorized = currentTenantId === headerTenantId;
			//if tenantId not matched reject request
			if (!isAuthorized) {
				return false;
			}
		} else {
			// if request to get/delete data using another tenantId then reject request.
			const httpMethods = [
				RequestMethodEnum.GET,
				RequestMethodEnum.DELETE
			];
			if (httpMethods.includes(method)) {
				if ('tenantId' in query) {
					const queryTenantId = query['tenantId'];
					isAuthorized = currentTenantId === queryTenantId;
					//if tenantId not matched reject request
					if (!isAuthorized) {
						return false;
					}
				} else if (query.hasOwnProperty('data')) {
					const data: any = query.data;
					const isJson = isJSON(data);
					if (isJson) {
						try {
							const parse = JSON.parse(data);
							//Match provided tenantId with logged in tenantId
							if (
								'findInput' in parse &&
								'tenantId' in parse['findInput']
							) {
								const queryTenantId =
									parse['findInput']['tenantId'];
								isAuthorized =
									currentTenantId === queryTenantId;
								//if tenantId not matched reject request
								if (!isAuthorized) {
									return false;
								}
							} else {
								//if tenantId not found in query params
								return false;
							}
						} catch (e) {
							console.log('Json Parser Error:', e);
							return isAuthorized;
						}
					}
				} else {
					//if tenantId not found in query params
					return false;
				}
			}

			// if request to save/update data using another tenantId then reject request.
			const payloadMethods = [
				RequestMethodEnum.POST,
				RequestMethodEnum.PUT,
				RequestMethodEnum.PATCH
			];
			if (payloadMethods.includes(method)) {
				const body: any = request.body;
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

			console.log(isAuthorized, 'isAuthorized');
		}

		//enabled AllowSuperAdminRole from .env file
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
				'Unauthorized access blocked. TenantId:',
				currentTenantId,
				' Permissions Checked:',
				permissions
			);
		}
		return isAuthorized;
	}
}
