import { Inject, Injectable, Logger, NestMiddleware, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request, Response, NextFunction } from 'express';
import { IIntegrationSetting, IntegrationEnum } from '@gauzy/contracts';
import { IntegrationTenantService } from '@gauzy/core';
import { arrayToObject, isNotEmpty } from '@gauzy/utils';

@Injectable()
export class MakeComMiddleware implements NestMiddleware {
	private readonly logger = new Logger(MakeComMiddleware.name);

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * Middleware to handle Make.com integration requests
	 * @param request - Express request object
	 * @param _response - Express response object
	 * @param next - Express next function
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
						this.logger.log(
							`Make.com integration settings loading for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
						);

						const cacheKey = `integrationTenantSettings_${tenantId}_${organizationId}_${integrationId}`;

						let integrationTenantSettings: IIntegrationSetting[] = await this.cacheManager.get(cacheKey);

						if (!integrationTenantSettings) {
							this.logger.log(
								`Make.com integration settings NOT loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
							);

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

							if (fromDb?.settings?.length) {
								integrationTenantSettings = fromDb.settings;

								const ttl = 5 * 60; // 5 min expressed in seconds
								await this.cacheManager.set(cacheKey, integrationTenantSettings, ttl);

								this.logger.log(
									`Make.com integration settings loaded from DB for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
								);
							}
						} else {
							this.logger.log(
								`Make.com integration settings loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}, integrationId: ${integrationId}`
							);
						}

						if (integrationTenantSettings?.length) {
							/** Create an 'integration' object and assign properties to it. */
							request['integration'] = {
								// Assign properties to the integration object
								id: integrationId,
								name: IntegrationEnum.MakeCom,
								// Convert the 'settings' array to an object using the 'settingsName' and 'settingsValue' properties
								settings: arrayToObject(integrationTenantSettings, 'settingsName', 'settingsValue')
							};
						} else {
							return next(
								new NotFoundException('Make.com integration settings not found')
							)
						}
					} catch (error) {
						this.logger.error(
							`Error while getting integration (${IntegrationEnum.MakeCom}) tenant: %s`,
							error?.message
						);
						this.logger.error(request.path, request.url);
					}
				}
			}
		} catch (error) {
			this.logger.error(
				`Error while getting integration (${IntegrationEnum.MakeCom}) tenant inside middleware: %s`,
				error?.message
			);
			this.logger.error(request.path, request.url);
		}

		// Continue to the next middleware or route handler
		next();
	}
}
