import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { IntegrationUpworkUiModule } from './integration-upwork-ui.module';
import { INTEGRATION_UPWORK_PAGE_ROUTE } from './integration-upwork.routes';

/**
 * Integration Upwork plugin definition.
 *
 * Registers the /pages/integrations/upwork route.
 */
export const IntegrationUpworkPlugin: PluginUiDefinition = {
	id: 'integration-upwork',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'integrations-sections',
	module: IntegrationUpworkUiModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [INTEGRATION_UPWORK_PAGE_ROUTE as PluginRouteInput]
};
