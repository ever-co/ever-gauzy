import { IntegrationEnum } from '@gauzy/contracts';

/** The catalog name of the integration (`integration.name`, `integration_tenant.name`). */
export const EVER_WORKS_INTEGRATION_NAME = IntegrationEnum.EVER_WORKS;

/** The UI route under `/pages/integrations` (the catalog row's `redirectUrl`). */
export const EVER_WORKS_REDIRECT_URL = 'ever-works';

/** The catalog icon, relative to the API's public assets (`apps/api/src/assets/seed/integrations`). */
export const EVER_WORKS_CATALOG_ICON = 'integrations/ever-works.svg';

/** Position on the Integrations page: after Ever Async (12) and Ever Platform (13). */
export const EVER_WORKS_CATALOG_ORDER = 14;

/** The integration contract version this plugin speaks (Ever Works `/api/integrations/v1`). */
export const EVER_WORKS_CONTRACT_VERSION = '1';

/** The plugin's own version, sent in `User-Agent` and shown on the status route. */
export const EVER_WORKS_PLUGIN_VERSION = '0.1.0';

/** Base path of every route of this plugin (under the API's global `/api` prefix). */
export const EVER_WORKS_ROUTE_PREFIX = '/integration/ever-works';

/**
 * The `externalRef.source` (and `externalLinks[].source`) of every record this plugin links in Ever Works.
 * Ever Works derives a key's link source from its `integrationKind` — an `ever-gauzy` key links as `gauzy`
 * (contract v1, CR-1) — and refuses any other value with `400 validation_failed` (`externalRef.source`).
 */
export const EVER_WORKS_LINK_SOURCE = 'gauzy';
