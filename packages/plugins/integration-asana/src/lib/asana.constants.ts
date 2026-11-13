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
	ATTENTION_REASON = 'attention_reason',
	/** When the Inbox notice of the attention was filed (empty: none filed, or resolved). */
	ATTENTION_NOTICE_AT = 'attention_notice_at'
}

/** The largest webhook body accepted. */
export const ASANA_WEBHOOK_MAX_BYTES = 1024 * 1024;
/** How long after a registration starts its handshake is accepted. */
export const ASANA_WEBHOOK_HANDSHAKE_WINDOW_MS = 10 * 60_000;

/** How many tasks one page of an import asks for, and the safety cap of one run (it then keeps its position and says so). */
export const ASANA_TASKS_PAGE_SIZE = 100;
/** How many applies may hold a transaction (and its pool connection) at once in one process. */
export const ASANA_APPLY_CONCURRENCY = 4;
/** How far down a task's subtasks are followed (a subtask of a subtask is depth 2). */
export const ASANA_SUBTASK_MAX_DEPTH = 5;
/** The import position is the run's start minus this margin: a change made while the pages were read is not skipped next time. */
export const ASANA_IMPORT_CLOCK_SKEW_MS = 60_000;

/** An access token this close to its expiry is renewed before use. */
export const ASANA_TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000;

/** The queue the scheduled import sweep travels on, the schedule that asks for it, and the queue job it runs as. */
export const ASANA_QUEUE_NAME = 'integration-asana';
export const ASANA_IMPORT_SWEEP_SCHEDULE = 'integration-asana-import-sweep';
export const ASANA_IMPORT_SWEEP_JOB = 'integration-asana.import-due';
/** The default of `ASANA_IMPORT_INTERVAL_MINUTES`: how many minutes apart a mapping's changes are imported. */
export const ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT = 15;
/** How many mappings one sweep imports at most (the longest waiting first; the rest wait for the next sweep). */
export const ASANA_IMPORT_SWEEP_BATCH = 50;
/** A mapping with a live webhook is swept this many intervals apart: a reconcile of missed deliveries, not a second feed. */
export const ASANA_IMPORT_WEBHOOK_STRIDE = 4;
/** A mapping counts as due this long before its interval is up, so one imported right after a sweep does not slip a whole sweep. */
export const ASANA_IMPORT_SWEEP_SLACK_MS = 60_000;
/** How many times the queue tries a sweep that could not run, and the first delay between tries (doubled each time). */
export const ASANA_IMPORT_SWEEP_ATTEMPTS = 3;
export const ASANA_IMPORT_SWEEP_RETRY_DELAY_MS = 30_000;

/** Error codes the routes answer with (`{ message, code }`). */
export const ASANA_NOT_CONFIGURED = 'ASANA_NOT_CONFIGURED';
export const ASANA_NOT_CONNECTED = 'ASANA_NOT_CONNECTED';
export const ASANA_TOKEN_REFUSED = 'ASANA_TOKEN_REFUSED';
export const ASANA_UNAVAILABLE = 'ASANA_UNAVAILABLE';
export const ASANA_REQUEST_REFUSED = 'ASANA_REQUEST_REFUSED';
export const ASANA_WEBHOOK_NOT_REMOVED = 'ASANA_WEBHOOK_NOT_REMOVED';
export const ASANA_STATE_INVALID = 'ASANA_STATE_INVALID';
export const ASANA_MAPPING_EXISTS = 'ASANA_MAPPING_EXISTS';
export const ASANA_PROJECT_OUTBOUND_TAKEN = 'ASANA_PROJECT_OUTBOUND_TAKEN';
export const ASANA_PROJECT_NOT_FOUND = 'ASANA_PROJECT_NOT_FOUND';
export const ASANA_RUN_IN_PROGRESS = 'ASANA_RUN_IN_PROGRESS';
export const ASANA_MAPPING_NOT_INBOUND = 'ASANA_MAPPING_NOT_INBOUND';
export const ASANA_MAPPING_PROJECT_FIXED = 'ASANA_MAPPING_PROJECT_FIXED';
export const ASANA_CONFLICT_NOT_FOUND = 'ASANA_CONFLICT_NOT_FOUND';
export const ASANA_CONFLICT_STALE = 'ASANA_CONFLICT_STALE';
