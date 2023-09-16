import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { RequestConfigProvider } from '@gauzy/integration-ai';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@Injectable()
export class IntegrationAIMiddleware implements NestMiddleware {

    constructor(
        private readonly integrationTenantService: IntegrationTenantService,
        private readonly requestConfigProvider: RequestConfigProvider,
    ) { }

    async use(
        request: Request,
        response: Response,
        next: NextFunction
    ) {
        // Extract tenant and organization IDs from request headers
        const tenantId = request.header('tenant-id');
        const organizationId = request.header('organization-id');

        // Log tenant and organization IDs
        console.log('Auth Tenant-ID Header: %s', tenantId);
        console.log('Auth Organization-ID Header: %s', organizationId);

        // Initialize custom headers
        request.headers['X-APP-ID'] = null;
        request.headers['X-API-KEY'] = null;

        try {
            // Check if tenant and organization IDs are not empty
            if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
                // Fetch integration settings from the service
                const { settings = [] } = await this.integrationTenantService.getIntegrationSettings({ tenantId, organizationId });
                // Convert settings array to an object
                const { apiKey: ApiKey, apiSecret: ApiSecret } = arrayToObject(settings, 'settingsName', 'settingsValue');

                if (ApiKey && ApiSecret) {
                    // Update custom headers and request configuration with API key and secret
                    request.headers['X-APP-ID'] = ApiKey;
                    request.headers['X-API-KEY'] = ApiSecret;

                    this.requestConfigProvider.setConfig({ ApiKey, ApiSecret });
                }
            }
        } catch (error) {
            console.log('Error while getting AI integration settings: %s', error?.message);
        }

        // Continue to the next middleware or route handler
        next();
    }
}
