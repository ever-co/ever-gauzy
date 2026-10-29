import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request, Response, NextFunction } from 'express';
import { IIntegrationSetting, IntegrationEnum } from '@gauzy/contracts';
import { arrayToObject, isNotEmpty } from '@gauzy/utils';
import { IntegrationTenantService } from '@gauzy/core';
import { RequestConfigProvider } from './request-config.provider';

/**
 * The `tenantId` claim of the request's bearer token, read without verifying the token, or undefined.
 *
 * This middleware runs before authentication, and it used to take the tenant from the `tenant-id` header or the body:
 * a signed-in user of one tenant who named another tenant there had that tenant's Gauzy AI and OpenAI keys loaded for
 * the request, and the job routes then called Gauzy AI with them. The token's own claim names the caller's tenant. It
 * is only decoded here, as `TenantSettingsMiddleware` does: every route this middleware serves runs after the
 * AuthGuard has verified the token, so the keys of a tenant named by a forged token never reach a handler.
 *
 * @param authorization The `Authorization` header.
 */
export function bearerTenantId(authorization: string | undefined): string | undefined {
	const payload = /^Bearer\s+([^.\s]+)\.([^.\s]+)\.[^\s]*$/i.exec(authorization ?? '')?.[2];
	if (!payload) {
		return undefined;
	}
	try {
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return typeof claims?.tenantId === 'string' && claims.tenantId ? claims.tenantId : undefined;
	} catch {
		return undefined;
	}
}

/** How long the absence of a Gauzy AI integration is remembered for an organization (milliseconds). */
export const INTEGRATION_ABSENCE_TTL_MS = 60 * 1000;

@Injectable()
export class IntegrationAIMiddleware implements NestMiddleware {
	private logging = false;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _requestConfigProvider: RequestConfigProvider
	) {}

	/**
	 * Middleware to handle setting up AI integration configuration headers based on request headers and body.
	 *
	 * @param request - The incoming HTTP request object.
	 * @param _response - The outgoing HTTP response object (not used directly).
	 * @param next - The callback function to invoke to pass control to the next middleware or route handler.
	 */
	async use(request: Request, _response: Response, next: NextFunction) {
		try {
			// The caller's tenant (never a header or the body: see bearerTenantId), and an organization within it
			const tenantId = bearerTenantId(request.header('authorization'));
			const organizationId = request.header('organization-id') || request.body?.organizationId;

			// Logging tenant and organization IDs if logging is enabled
			if (this.logging) {
				console.log('Auth Tenant-ID Header: %s', tenantId);
				console.log('Auth Organization-ID Header: %s', organizationId);
			}

			// Initialize custom headers
			request.headers['X-APP-ID'] = null;
			request.headers['X-API-KEY'] = null;
			request.headers['X-OPENAI-SECRET-KEY'] = null;
			request.headers['X-OPENAI-ORGANIZATION-ID'] = null;

			// Reset request configuration provider if no integration settings found
			this._requestConfigProvider.resetConfig();

			// Check if tenant and organization IDs are not empty
			if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
				if (this.logging) {
					console.log(
						`Getting Gauzy AI integration settings from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`
					);
				}

				const cacheKey = `integrationTenantSettings_${tenantId}_${organizationId}_${IntegrationEnum.GAUZY_AI}`;

				// Fetch integration settings from cache
				let integrationTenantSettings: IIntegrationSetting[] = await this.cacheManager.get(cacheKey);

				if (!integrationTenantSettings) {
					if (this.logging) {
						console.log(
							`Gauzy AI integration settings NOT loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`
						);
					}

					// Fetch integration settings from database if not in cache
					const fromDb = await this._integrationTenantService.getIntegrationTenantSettings({
						tenantId,
						organizationId,
						name: IntegrationEnum.GAUZY_AI
					});

					if (fromDb && fromDb.settings) {
						integrationTenantSettings = fromDb.settings;

						const ttl = 5 * 60 * 1000; // 5 min caching period for Integration Tenant Settings
						await this.cacheManager.set(cacheKey, integrationTenantSettings, ttl);

						if (this.logging) {
							console.log(
								`Gauzy AI integration settings loaded from DB and stored in Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`
							);
						}
					} else {
						// Most organizations have no Gauzy AI integration: remember that too (an empty list), for a
						// shorter while, or every request of theirs reads the database again (and logs "record not
						// found"). A newly connected integration is picked up within the minute.
						integrationTenantSettings = [];
						await this.cacheManager.set(cacheKey, integrationTenantSettings, INTEGRATION_ABSENCE_TTL_MS);
					}
				} else {
					if (this.logging) {
						console.log(
							`Gauzy AI integration settings loaded from Cache for tenantId: ${tenantId}, organizationId: ${organizationId}`
						);
					}
				}

				// Process integration settings if available
				if (integrationTenantSettings && integrationTenantSettings.length > 0) {
					const settings = arrayToObject(integrationTenantSettings, 'settingsName', 'settingsValue');

					// Log API Key and API Secret if logging is enabled
					if (this.logging) {
						console.log('AI Integration API Key:', settings.apiKey);
						console.log('AI Integration API Secret:', settings.apiSecret);
					}

					const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId } = settings;

					// Update custom headers and request configuration with API key and secret
					if (apiKey && apiSecret) {
						request.headers['X-APP-ID'] = apiKey;
						request.headers['X-API-KEY'] = apiSecret;

						// Add OpenAI secret key if available
						if (isNotEmpty(openAiSecretKey)) {
							request.headers['X-OPENAI-SECRET-KEY'] = openAiSecretKey;
						}

						// Add OpenAI organization ID if available
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
