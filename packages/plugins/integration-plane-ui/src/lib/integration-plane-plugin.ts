import { PermissionsEnum } from '@gauzy/contracts';
import { PluginUiDefinition } from '@gauzy/plugin-ui';
import { IntegrationPlaneUiModule } from './integration-plane-ui.module';
import { INTEGRATION_PLANE_PAGE_ROUTE } from './integration-plane.routes';

/**
 * Integration Plane plugin definition.
 *
 * Registers the /pages/integrations/plane route.
 */
export const IntegrationPlanePlugin: PluginUiDefinition = {
	id: 'integration-plane',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'integrations-sections',
	module: IntegrationPlaneUiModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [INTEGRATION_PLANE_PAGE_ROUTE]
};
