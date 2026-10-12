import { PermissionsEnum } from '@gauzy/contracts';
import { PluginUiDefinition } from '@gauzy/plugin-ui';
import { IntegrationEverAsyncUiModule } from './integration-ever-async-ui.module';
import { INTEGRATION_EVER_ASYNC_PAGE_ROUTE } from './integration-ever-async.routes';

/**
 * Integration Ever Async plugin definition.
 *
 * Registers the /pages/integrations/ever-async route.
 */
export const IntegrationEverAsyncPlugin: PluginUiDefinition = {
	id: 'integration-ever-async',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'integrations-sections',
	module: IntegrationEverAsyncUiModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [INTEGRATION_EVER_ASYNC_PAGE_ROUTE]
};
