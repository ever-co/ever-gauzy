import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { EverWorksConfig } from './ever-works-config';
import {
	EVER_WORKS_CONTRACT_VERSION,
	EVER_WORKS_PLUGIN_VERSION,
	EVER_WORKS_ROUTE_PREFIX
} from './ever-works.constants';
import { EVER_WORKS_CONFIG } from './ever-works.tokens';

/** `GET /api/integration/ever-works/status`. */
export interface EverWorksStatusResponse {
	/** Always `true`: the route exists only where the plugin is loaded (`EVER_WORKS_ENABLED=true`). */
	enabled: true;
	pluginVersion: string;
	/** The Ever Works integration contract this plugin speaks (`/api/integrations/v<n>`). */
	contractVersion: string;
	/** The default Ever Works API URL the connect form offers, or `null` (`EVER_WORKS_API_URL`). */
	defaultApiUrl: string | null;
	/** The Ever Works web app that creates integration keys, or `null` (`EVER_WORKS_APP_URL`). */
	appUrl: string | null;
}

/**
 * The management API of the Ever Works integration. Every route needs a signed-in user of the tenant
 * with the integration permissions; where the plugin is not loaded (the default) the routes do not
 * exist and answer 404, which is how the web app tells the integration is switched off.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(EVER_WORKS_ROUTE_PREFIX)
export class EverWorksController {
	constructor(@Inject(EVER_WORKS_CONFIG) private readonly config: EverWorksConfig) {}

	@Get('/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Whether the Ever Works integration is loaded, and what the connect form offers.' })
	status(): EverWorksStatusResponse {
		return {
			enabled: true,
			pluginVersion: EVER_WORKS_PLUGIN_VERSION,
			contractVersion: EVER_WORKS_CONTRACT_VERSION,
			defaultApiUrl: this.config.defaultApiUrl,
			appUrl: this.config.appUrl
		};
	}
}
