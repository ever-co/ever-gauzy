import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { IIntegrationSetting, IntegrationEnum } from '@gauzy/contracts';
import { RequestConfigProvider } from '@gauzy/integration-ai';
import { arrayToObject } from './../../core/utils';
import { IntegrationTenantService } from './../../integration-tenant/integration-tenant.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class IntegrationAIMiddleware implements NestMiddleware {
	private logging = true;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _requestConfigProvider: RequestConfigProvider
	) { }

	async use(request: Request, _response: Response, next: NextFunction) {
		try {
			// Extract tenant and organization IDs from request headers and body
			const tenantId = request.header('tenant-id') || request.body?.tenantId;
			const organizationId = request.header('organization-id') || request.body?.organizationId;

			if (this.logging) {
				// Log tenant and organization IDs
				console.log('Auth Tenant-ID Header: %s', tenantId);
				console.log('Auth Organization-ID Header: %s', organizationId);
			}

			// Initialize custom headers
			request.headers['X-APP-ID'] = null;
			request.headers['X-API-KEY'] = null;
			request.headers['X-OPENAI-SECRET-KEY'] = null;
			request.headers['X-OPENAI-ORGANIZATION-ID'] = null;

			// Set default configuration in the requestConfigProvider if no integration settings found
			this._requestConfigProvider.resetConfig();

			// Check if tenant and organization IDs are not empty
			if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
				console.log(`Getting Gauzy AI integration settings from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`);

				const cacheKey = `integrationTenantSettings_${tenantId}_${organizationId}_${IntegrationEnum.GAUZY_AI}`;

				// Fetch integration settings from the service
				let integrationTenantSettings: IIntegrationSetting[] = await this.cacheManager.get(cacheKey);

				if (!integrationTenantSettings) {
					console.log(`Gauzy AI integration settings NOT loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`);

					const fromDb = await this._integrationTenantService.getIntegrationTenantSettings({
						tenantId,
						organizationId,
						name: IntegrationEnum.GAUZY_AI
					});

					if (fromDb && fromDb.settings) {
						integrationTenantSettings = fromDb.settings;

						const ttl = 5 * 60 * 1000 // 5 min caching period for Integration Tenant Settings
						await this.cacheManager.set(cacheKey, integrationTenantSettings, ttl);

						console.log(`Gauzy AI integration settings loaded from DB and stored in Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`);
					}
				} else {
					console.log(`Gauzy AI integration settings loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`);
				}

				if (integrationTenantSettings && integrationTenantSettings.length > 0) {
					const settings = arrayToObject(integrationTenantSettings, 'settingsName', 'settingsValue');

					// Log API Key and API Secret if logging is enabled
					if (this.logging) {
						console.log('AI Integration API Key:', settings.apiKey);
						console.log('AI Integration API Secret:', settings.apiSecret);
					}

					const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId } = settings;

					if (apiKey && apiSecret) {
						// Update custom headers and request configuration with API key and secret
						request.headers['X-APP-ID'] = apiKey;
						request.headers['X-API-KEY'] = apiSecret;

						// Add OpenAI headers if available
						if (isNotEmpty(openAiSecretKey)) {
							request.headers['X-OPENAI-SECRET-KEY'] = openAiSecretKey;
						}

						if (isNotEmpty(openAiOrganizationId)) {
							request.headers['X-OPENAI-ORGANIZATION-ID'] = openAiOrganizationId;
						}

						// Log configuration settings if logging is enabled
						if (this.logging) {
							console.log('AI Integration Config Settings:', {
								apiKey,
								apiSecret,
								openAiSecretKey,
								openAiOrganizationId
							});
						}

						// Set configuration in the requestConfigProvider
						this._requestConfigProvider.setConfig({
							apiKey,
							apiSecret,
							...(isNotEmpty(openAiSecretKey) && { openAiSecretKey }),
							...(isNotEmpty(openAiOrganizationId) && { openAiOrganizationId })
						});
					}
				}
			}
		} catch (error) {
			console.log('Error while getting AI integration settings: %s', error?.message);
			console.log(request.path, request.url);
		}

		// Continue to the next middleware or route handler
		next();
	}
}
