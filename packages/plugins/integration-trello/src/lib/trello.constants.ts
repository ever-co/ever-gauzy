import { IntegrationEnum } from '@gauzy/contracts';

/** The catalogue name of the integration (`integration.name` and `integration_tenant.name`). */
export const TRELLO_INTEGRATION_NAME = IntegrationEnum.TRELLO;

/** Every route of the plugin hangs off this prefix (under the API's own `/api`). */
export const TRELLO_ROUTE_PREFIX = '/integration/trello';

/** The catalogue card: its icon in the seed assets, its order among the cards, and the UI path it opens. */
export const TRELLO_CATALOG_ICON = 'trello.svg';
export const TRELLO_CATALOG_ORDER = 15;
export const TRELLO_REDIRECT_URL = 'trello';

/** Where Trello answers. */
export const TRELLO_API_URL = 'https://api.trello.com/1';
/** The page a person authorizes the application on; it sends them back with the token in the URL fragment. */
export const TRELLO_AUTHORIZE_URL = 'https://trello.com/1/authorize';
/** The name Trello shows on the authorize page unless the operator sets one. */
export const TRELLO_DEFAULT_APP_NAME = 'Ever Gauzy';

/** The injection token of the plugin's configuration (`readTrelloConfig`). */
export const TRELLO_CONFIG = 'TRELLO_CONFIG';

/** The `integration_setting` rows of a connected organization. */
export enum TrelloSettingName {
	/** The member token Trello handed out (it does not expire; a person may revoke it). */
	TOKEN = 'token',
	/** The Trello member the token belongs to. */
	TRELLO_MEMBER_ID = 'trello_member_id',
	TRELLO_MEMBER_USERNAME = 'trello_member_username',
	TRELLO_MEMBER_NAME = 'trello_member_name',
	/** The Gauzy user who connected: the sync's writes are attributed to them. */
	CONNECTED_BY_USER_ID = 'connected_by_user_id',
	/** Why the connection needs attention (a refused token), or empty. */
	ATTENTION_REASON = 'attention_reason'
}

/** The largest webhook body accepted. */
export const TRELLO_WEBHOOK_MAX_BYTES = 1024 * 1024;

/** How many cards one page of a board read asks for (Trello's largest page). */
export const TRELLO_CARDS_PAGE_SIZE = 1000;
/** How many applies may hold a transaction (and its pool connection) at once in one process. */
export const TRELLO_APPLY_CONCURRENCY = 4;

/** Error codes the routes answer with (`{ message, code }`). */
export const TRELLO_NOT_CONFIGURED = 'TRELLO_NOT_CONFIGURED';
export const TRELLO_NOT_CONNECTED = 'TRELLO_NOT_CONNECTED';
export const TRELLO_TOKEN_REFUSED = 'TRELLO_TOKEN_REFUSED';
export const TRELLO_STATE_INVALID = 'TRELLO_STATE_INVALID';
export const TRELLO_MAPPING_EXISTS = 'TRELLO_MAPPING_EXISTS';
export const TRELLO_PROJECT_OUTBOUND_TAKEN = 'TRELLO_PROJECT_OUTBOUND_TAKEN';
export const TRELLO_PROJECT_NOT_FOUND = 'TRELLO_PROJECT_NOT_FOUND';
export const TRELLO_RUN_IN_PROGRESS = 'TRELLO_RUN_IN_PROGRESS';
export const TRELLO_MAPPING_NOT_INBOUND = 'TRELLO_MAPPING_NOT_INBOUND';
export const TRELLO_MAPPING_PROJECT_FIXED = 'TRELLO_MAPPING_PROJECT_FIXED';
