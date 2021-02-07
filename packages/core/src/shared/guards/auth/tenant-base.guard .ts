import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RequestContext } from '../../../core/context';
import { RequestMethodEnum } from '@gauzy/contracts';
import { isJSON } from 'class-validator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TenantBaseGuard implements CanActivate {
	constructor(protected readonly reflector: Reflector) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { tenantId: currentTenantId } = RequestContext.currentUser();
		const request: any = context.switchToHttp().getRequest();
		const method: RequestMethodEnum = request.method;
		const query: any = request.query;

		let isAuthorized = false;
		if (!currentTenantId) {
			return isAuthorized;
		}

		// Get Tenant-Id from request headers
		const headerTenantId = context.switchToHttp().getRequest().headers[
			'Tenant-Id'
		];

		const rawHeaders = context.switchToHttp().getRequest().rawHeaders;
		if (
			headerTenantId &&
			(rawHeaders.includes('tenant-id') ||
				rawHeaders.includes('Tenant-Id'))
		) {
			isAuthorized = currentTenantId === headerTenantId;
		} else {
			//If request to get/delete data using another tenantId then reject request.
			const httpMethods = [
				RequestMethodEnum.GET,
				RequestMethodEnum.DELETE
			];
			if (httpMethods.includes(method)) {
				if ('tenantId' in query) {
					const queryTenantId = query['tenantId'];
					isAuthorized = currentTenantId === queryTenantId;
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
							} else {
								//If tenantId not found in query params
								return false;
							}
						} catch (e) {
							console.log('Json Parser Error:', e);
							return isAuthorized;
						}
					}
				} else {
					//If tenantId not found in query params
					isAuthorized = false;
				}
			}

			// If request to save/update data using another tenantId then reject request.
			const payloadMethods = [
				RequestMethodEnum.POST,
				RequestMethodEnum.PUT,
				RequestMethodEnum.PATCH
			];
			if (payloadMethods.includes(method)) {
				const body: any = request.body;
				let bodyTenantId: string;
				if ('tenantId' in body) {
					bodyTenantId = body['tenantId'];
				} else if ('tenant' in body) {
					bodyTenantId = body['tenant']['id'];
				}
				isAuthorized = currentTenantId === bodyTenantId;
			}
		}
		if (!isAuthorized) {
			console.log(
				'Unauthorized access blocked. TenantId:',
				headerTenantId
			);
		}
		return isAuthorized;
	}
}
