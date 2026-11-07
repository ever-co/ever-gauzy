import { IntegrationEnum } from '@gauzy/contracts';

/** The catalogue name of the integration (`integration.name` and `integration_tenant.name`). */
export const ASANA_INTEGRATION_NAME = IntegrationEnum.ASANA;

/** Every route of the plugin hangs off this prefix (under the API's own `/api`). */
export const ASANA_ROUTE_PREFIX = '/integration/asana';

/** The catalogue card: its icon in the seed assets, its order among the cards, and the UI path it opens. */
export const ASANA_CATALOG_ICON = 'asana.svg';
export const ASANA_CATALOG_ORDER = 14;
export const ASANA_REDIRECT_URL = 'asana';

/** Where Asana answers. */
export const ASANA_API_URL = 'https://app.asana.com/api/1.0';
export const ASANA_OAUTH_AUTHORIZE_URL = 'https://app.asana.com/-/oauth_authorize';
export const ASANA_OAUTH_TOKEN_URL = 'https://app.asana.com/-/oauth_token';

/** The injection token of the plugin's configuration (`readAsanaConfig`). */
export const ASANA_CONFIG = 'ASANA_CONFIG';

/** The `integration_setting` rows of a connected organization. */
export enum AsanaSettingName {
	ACCESS_TOKEN = 'access_token',
	/** Renews the access token before it expires (Asana's last an hour). */
	REFRESH_TOKEN = 'refresh_token',
	TOKEN_TYPE = 'token_type',
	EXPIRES_AT = 'expires_at',
	/** The Asana user the token belongs to. */
	ASANA_USER_GID = 'asana_user_gid',
	ASANA_USER_NAME = 'asana_user_name',
	ASANA_USER_EMAIL = 'asana_user_email',
	/** The Gauzy user who connected: the sync's writes are attributed to them. */
	CONNECTED_BY_USER_ID = 'connected_by_user_id',
	/** Why the connection needs attention (a refused token), or empty. */
	ATTENTION_REASON = 'attention_reason'
}

/** The largest webhook body accepted. */
export const ASANA_WEBHOOK_MAX_BYTES = 1024 * 1024;
/** How long after a registration starts its handshake is accepted. */
export const ASANA_WEBHOOK_HANDSHAKE_WINDOW_MS = 10 * 60_000;

/** How many tasks one page of an import asks for, and the safety cap of one run (it then keeps its position and says so). */
export const ASANA_TASKS_PAGE_SIZE = 100;
export const ASANA_IMPORT_MAX_TASKS = 50_000;

/** An access token this close to its expiry is renewed before use. */
export const ASANA_TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000;

/** Error codes the routes answer with (`{ message, code }`). */
export const ASANA_NOT_CONFIGURED = 'ASANA_NOT_CONFIGURED';
export const ASANA_NOT_CONNECTED = 'ASANA_NOT_CONNECTED';
export const ASANA_TOKEN_REFUSED = 'ASANA_TOKEN_REFUSED';
export const ASANA_STATE_INVALID = 'ASANA_STATE_INVALID';
export const ASANA_MAPPING_EXISTS = 'ASANA_MAPPING_EXISTS';
export const ASANA_PROJECT_OUTBOUND_TAKEN = 'ASANA_PROJECT_OUTBOUND_TAKEN';
export const ASANA_PROJECT_NOT_FOUND = 'ASANA_PROJECT_NOT_FOUND';
export const ASANA_RUN_IN_PROGRESS = 'ASANA_RUN_IN_PROGRESS';
