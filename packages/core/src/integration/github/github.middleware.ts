import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isNotEmpty } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@Injectable()
export class GithubMiddleware implements NestMiddleware {

    constructor(
        private readonly _integrationTenantService: IntegrationTenantService,
    ) { }

    async use(
        request: Request,
        response: Response,
        next: NextFunction
    ) {
        try {
            const integrationId = request.params['integrationId'];
            const queryParameters = request.query;

            const tenantId = queryParameters.tenantId ? queryParameters.tenantId.toString() : request.header('Tenant-Id');
            const organizationId = queryParameters.organizationId ? queryParameters.organizationId.toString() : request.header('Organization-Id');

            // Check if tenant and organization IDs are not empty
            if (isNotEmpty(tenantId) && isNotEmpty(organizationId)) {
                // Fetch integration settings from the service
                const { settings = [] } = await this._integrationTenantService.findOneByIdString(integrationId, {
                    where: {
                        tenantId,
                        organizationId
                    },
                    relations: {
                        settings: true
                    }
                });
                /** */
                request['integration'] = new Object({
                    name: IntegrationEnum.GITHUB,
                    // Convert settings array to an object
                    settings: arrayToObject(settings, 'settingsName', 'settingsValue')
                });
            }
        } catch (error) {
            console.log(`Error while getting integration (${IntegrationEnum.GITHUB}) tenant inside middleware: %s`, error?.message);
            console.log(request.path, request.url);
        }

        // Continue to the next middleware or route handler
        next();
    }
}
