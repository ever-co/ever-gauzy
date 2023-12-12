import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { RequestConfigProvider } from '@gauzy/integration-ai';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@Injectable()
export class IntegrationAIMiddleware implements NestMiddleware {

    private logging: boolean = true;

    constructor(
        private readonly integrationTenantService: IntegrationTenantService,
        private readonly requestConfigProvider: RequestConfigProvider,
    ) { }

    async use(
        request: Request,
        _response: Response,
        next: NextFunction
    ) {
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

        try {
            // Check if tenant and organization IDs are not empty
            if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
                // Fetch integration settings from the service
                const { settings = [] } = await this.integrationTenantService.getIntegrationTenantSettings({
                    tenantId,
                    organizationId,
                    name: IntegrationEnum.GAUZY_AI
                });
                // Convert settings array to an object
                const { apiKey, apiSecret, openAiApiSecretKey } = arrayToObject(settings, 'settingsName', 'settingsValue');

                if (this.logging) {
                    console.log('AI Integration API Key: %s', apiKey);
                    console.log('AI Integration API Secret: %s', apiSecret);
                }

                if (apiKey && apiSecret) {
                    // Update custom headers and request configuration with API key and secret
                    request.headers['X-APP-ID'] = apiKey;
                    request.headers['X-API-KEY'] = apiSecret;

                    if (isNotEmpty(openAiApiSecretKey)) {
                        request.headers['X-OPENAI-SECRET-KEY'] = openAiApiSecretKey;
                    }

                    if (this.logging) {
                        console.log('AI Integration Config Settings: %s', { apiKey, apiSecret });
                    }

                    this.requestConfigProvider.setConfig({
                        apiKey,
                        apiSecret,
                        ...(isNotEmpty(openAiApiSecretKey) && { openAiApiSecretKey }),
                    });
                }
            }
        } catch (error) {
            console.log('Error while getting AI integration settings: %s', error?.message);
        }

        // Continue to the next middleware or route handler
        next();
    }
}
