import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { IIntegrationSetting, IntegrationEnum } from '@gauzy/contracts';
import { arrayToObject } from '../../core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@Injectable()
export class GithubMiddleware implements NestMiddleware {
	private logging = true;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 *
	 * @param request
	 * @param _response
	 * @param next
	 */
	async use(request: Request, _response: Response, next: NextFunction) {
		try {
			const integrationId = request.params['integrationId'];

			if (integrationId) {
				const queryParameters = request.query;

				const tenantId = queryParameters.tenantId?.toString() ?? request.header('Tenant-Id');
				const organizationId = queryParameters.organizationId?.toString() ?? request.header('Organization-Id');

				// Check if tenant and organization IDs are not empty
				if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
					try {
						// Fetch integration settings from the service
						if (this.logging) {
							console.log(`Getting i4net integration settings from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`);
						}

						const cacheKey = `integrationTenantSettings_${tenantId}_${organizationId}_${integrationId}`;

						let integrationTenantSettings: IIntegrationSetting[] = await this.cacheManager.get(cacheKey);

						if (!integrationTenantSettings) {
							if (this.logging) {
								console.log(`i4net integration settings NOT loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`);
							}

							const fromDb = await this._integrationTenantService.findOneByIdString(integrationId, {
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
							});

							if (fromDb && fromDb.settings) {
								integrationTenantSettings = fromDb.settings;

								const ttl = 5 * 60 * 1000 // 5 min caching period for GitHub Integration Tenant Settings
								await this.cacheManager.set(cacheKey, integrationTenantSettings, ttl);

								if (this.logging) {
									console.log(`i4net integration settings loaded from DB and stored in Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`);
								}
							}
						} else {
							if (this.logging) {
								console.log(`i4net integration settings loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`);
							}
						}

						if (integrationTenantSettings && integrationTenantSettings.length > 0) {
							/** Create an 'integration' object and assign properties to it. */
							request['integration'] = new Object({
								// Assign properties to the integration object
								id: integrationId,
								name: IntegrationEnum.GITHUB,
								// Convert the 'settings' array to an object using the 'settingsName' and 'settingsValue' properties
								settings: arrayToObject(integrationTenantSettings, 'settingsName', 'settingsValue')
							});
						}
					} catch (error) {
						console.log(`Error while getting integration (${IntegrationEnum.GITHUB}) tenant inside middleware: %s`, error?.message);
						console.log(request.path, request.url);
					}
				}
			}
		} catch (error) {
			console.log(`Error while getting integration (${IntegrationEnum.GITHUB}) tenant inside middleware: %s`, error?.message);
			console.log(request.path, request.url);
		}

		// Continue to the next middleware or route handler
		next();
	}
}
