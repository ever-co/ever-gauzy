import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request, Response, NextFunction } from 'express';
import { IIntegrationSetting, IntegrationEnum } from '@gauzy/contracts';
import { IntegrationTenantService } from '@gauzy/core';
import { arrayToObject, isNotEmpty } from '@gauzy/utils';

@Injectable()
export class GithubMiddleware implements NestMiddleware {
	private logging = true;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	/**
	 *
	 * @param request
	 * @param _response
	 * @param next
	 */
	async use(request: Request, _response: Response, next: NextFunction) {
		try {
			const integrationIdParam = request.params['integrationId'];
			// Handle case where integrationId could be string or string[]
			const integrationId = Array.isArray(integrationIdParam) ? integrationIdParam[0] : integrationIdParam;

			if (integrationId) {
				const queryParameters = request.query;

				const tenantId = queryParameters.tenantId?.toString() ?? request.header('Tenant-Id');
				const organizationId = queryParameters.organizationId?.toString() ?? request.header('Organization-Id');

				// Check if tenant and organization IDs are not empty
				if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
					try {
						// Fetch integration settings from the service
						if (this.logging) {
							console.log(
								`Getting Gauzy integration settings from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
							);
						}

						const cacheKey = `integrationTenantSettings_${tenantId}_${organizationId}_${integrationId}`;

						let integrationTenantSettings: IIntegrationSetting[] = await this.cacheManager.get(cacheKey);

						if (!integrationTenantSettings) {
							if (this.logging) {
								console.log(
									`Gauzy integration settings NOT loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
								);
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

								const ttl = 5 * 60 * 1000; // 5 min caching period for GitHub Integration Tenant Settings
								await this.cacheManager.set(cacheKey, integrationTenantSettings, ttl);

								if (this.logging) {
									console.log(
										`Gauzy integration settings loaded from DB and stored in Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
									);
								}
							}
						} else {
							if (this.logging) {
								console.log(
									`Gauzy integration settings loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
								);
							}
						}

						if (integrationTenantSettings && integrationTenantSettings.length > 0) {
							/** Create an 'integration' object and assign properties to it. */
							// Record which tenant OWNS these settings. This middleware runs before
							// authentication and picks the tenant from `?tenantId=` ahead of the `Tenant-Id`
							// header, while the tenant guard validates only the header when one is sent — so
							// the tenant used here can differ from the caller's. GithubIntegrationTenantGuard
							// compares this against the authenticated tenant before any handler touches the
							// settings (GHSA-4rwq-65wh-45h4). Unknown owner: attach nothing (fail closed).
							const owner = integrationTenantSettings.find((setting) => !!setting?.tenantId);
							if (owner) {
								request['integration'] = new Object({
									// Assign properties to the integration object
									id: integrationId,
									name: IntegrationEnum.GITHUB,
									tenantId: owner.tenantId,
									organizationId: owner.organizationId,
									// Convert the 'settings' array to an object using the 'settingsName' and 'settingsValue' properties
									settings: arrayToObject(integrationTenantSettings, 'settingsName', 'settingsValue')
								});
							}
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
