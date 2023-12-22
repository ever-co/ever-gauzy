import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@Injectable()
export class GithubMiddleware implements NestMiddleware {
	constructor(private readonly _integrationTenantService: IntegrationTenantService) {}

	async use(request: Request, _response: Response, next: NextFunction) {
		try {
			const integrationId = request.params['integrationId'];

			if (integrationId) {
				const queryParameters = request.query;

				const tenantId = queryParameters.tenantId
					? queryParameters.tenantId.toString()
					: request.header('Tenant-Id');

				const organizationId = queryParameters.organizationId
					? queryParameters.organizationId.toString()
					: request.header('Organization-Id');

				// Check if tenant and organization IDs are not empty
				if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
					try {
						// Fetch integration settings from the service
						const integrationTenant = await this._integrationTenantService.findOneByIdString(
							integrationId,
							{
								where: {
									tenantId,
									organizationId,
									isActive: true,
									isArchived: false,
									integration: {
										isActive: true,
										isArchived: false
									}
								},
								relations: {
									settings: true
								}
							}
						);

						if (integrationTenant && integrationTenant.settings.length > 0) {
							/** Create an 'integration' object and assign properties to it. */
							request['integration'] = new Object({
								// Assign properties to the integration object
								id: integrationId,
								name: IntegrationEnum.GITHUB,
								// Convert the 'settings' array to an object using the 'settingsName' and 'settingsValue' properties
								settings: arrayToObject(integrationTenant.settings, 'settingsName', 'settingsValue')
							});
						}
					} catch (error) {
						console.log(
							`Error while getting integration (${IntegrationEnum.GITHUB}) tenant inside middleware: %s`,
							error?.message
						);
						console.log(request.path, request.url);
					}
				}
			}
		} catch (error) {
			console.log(
				`Error while getting integration (${IntegrationEnum.GITHUB}) tenant inside middleware: %s`,
				error?.message
			);
			console.log(request.path, request.url);
		}

		// Continue to the next middleware or route handler
		next();
	}
}
