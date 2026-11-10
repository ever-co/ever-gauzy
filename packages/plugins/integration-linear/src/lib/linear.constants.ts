import { IntegrationEnum } from '@gauzy/contracts';

/** The catalogue name of the integration (`integration.name` and `integration_tenant.name`). */
export const LINEAR_INTEGRATION_NAME = IntegrationEnum.LINEAR;

/** Every route of the plugin hangs off this prefix (under the API's own `/api`). */
export const LINEAR_ROUTE_PREFIX = '/integration/linear';

/** The catalogue card: its icon in the seed assets, its order among the cards, and the UI path it opens. */
export const LINEAR_CATALOG_ICON = 'linear.svg';
export const LINEAR_CATALOG_ORDER = 13;
export const LINEAR_REDIRECT_URL = 'linear';

/** Where Linear answers. */
export const LINEAR_API_URL = 'https://api.linear.app/graphql';
export const LINEAR_OAUTH_AUTHORIZE_URL = 'https://linear.app/oauth/authorize';
export const LINEAR_OAUTH_TOKEN_URL = 'https://api.linear.app/oauth/token';
/** What the connection asks for: reading the workspace, and writing issues back when a mapping sends changes out. */
export const LINEAR_OAUTH_SCOPES = ['read', 'write'];

/** The injection token of the plugin's configuration (`readLinearConfig`). */
export const LINEAR_CONFIG = 'LINEAR_CONFIG';

/** The `integration_setting` rows of a connected organization. */
export enum LinearSettingName {
	ACCESS_TOKEN = 'access_token',
	/** Renews the access token before it expires (rotated on every renewal). */
	REFRESH_TOKEN = 'refresh_token',
	TOKEN_TYPE = 'token_type',
	EXPIRES_AT = 'expires_at',
	SCOPE = 'scope',
	/** The Linear workspace the token belongs to: how a webhook finds the organizations it concerns. */
	LINEAR_ORGANIZATION_ID = 'linear_organization_id',
	LINEAR_ORGANIZATION_NAME = 'linear_organization_name',
	LINEAR_ORGANIZATION_URL_KEY = 'linear_organization_url_key',
	/** The Gauzy user who connected: the sync's writes are attributed to them. */
	CONNECTED_BY_USER_ID = 'connected_by_user_id',
	/** Why the connection needs attention (a refused token), or empty. */
	ATTENTION_REASON = 'attention_reason',
	/** When the Inbox notice of the attention was filed (empty: none filed, or resolved). */
	ATTENTION_NOTICE_AT = 'attention_notice_at'
}

/** The largest webhook body accepted. */
export const LINEAR_WEBHOOK_MAX_BYTES = 1024 * 1024;
/** How old a webhook's own timestamp may be (replays beyond it are refused). */
export const LINEAR_WEBHOOK_TOLERANCE_MS = 60_000;
/** How long a delivery id is remembered, so a retried delivery is applied once. */
export const LINEAR_WEBHOOK_DEDUPE_MS = 10 * 60 * 1000;

/**
 * How many issues one page of an import asks for (each comes with its latest comments and attachments, and Linear
 * budgets a query's complexity: ten issues with fifty comments each stay within it), and the safety cap of one run
 * (it then keeps its position and says so).
 */
export const LINEAR_ISSUES_PAGE_SIZE = 10;
export const LINEAR_IMPORT_MAX_ISSUES = 50_000;
/** The import position is the run's start minus this margin: a change made while the pages were read is not skipped next time. */
export const LINEAR_IMPORT_CLOCK_SKEW_MS = 60_000;

/** An access token this close to its expiry is renewed before use. */
export const LINEAR_TOKEN_REFRESH_AHEAD_MS = 10 * 60 * 1000;

/** The queue the scheduled import sweep travels on, the schedule that asks for it, and the queue job it runs as. */
export const LINEAR_QUEUE_NAME = 'integration-linear';
export const LINEAR_IMPORT_SWEEP_SCHEDULE = 'integration-linear-import-sweep';
export const LINEAR_IMPORT_SWEEP_JOB = 'integration-linear.import-due';
/** The default of `LINEAR_IMPORT_INTERVAL_MINUTES`: how many minutes apart a mapping's changes are imported. */
export const LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT = 15;
/** How many mappings one sweep imports at most (the longest waiting first; the rest wait for the next sweep). */
export const LINEAR_IMPORT_SWEEP_BATCH = 50;
/** A mapping with a live webhook is swept this many intervals apart: a reconcile of missed deliveries, not a second feed. */
export const LINEAR_IMPORT_WEBHOOK_STRIDE = 4;
/** A mapping counts as due this long before its interval is up, so one imported right after a sweep does not slip a whole sweep. */
export const LINEAR_IMPORT_SWEEP_SLACK_MS = 60_000;
/** How many times the queue tries a sweep that could not run, and the first delay between tries (doubled each time). */
export const LINEAR_IMPORT_SWEEP_ATTEMPTS = 3;
export const LINEAR_IMPORT_SWEEP_RETRY_DELAY_MS = 30_000;

/** Error codes the routes answer with (`{ message, code }`). */
export const LINEAR_NOT_CONFIGURED = 'LINEAR_NOT_CONFIGURED';
export const LINEAR_NOT_CONNECTED = 'LINEAR_NOT_CONNECTED';
export const LINEAR_TOKEN_REFUSED = 'LINEAR_TOKEN_REFUSED';
export const LINEAR_STATE_INVALID = 'LINEAR_STATE_INVALID';
export const LINEAR_MAPPING_EXISTS = 'LINEAR_MAPPING_EXISTS';
export const LINEAR_PROJECT_OUTBOUND_TAKEN = 'LINEAR_PROJECT_OUTBOUND_TAKEN';
export const LINEAR_PROJECT_NOT_FOUND = 'LINEAR_PROJECT_NOT_FOUND';
export const LINEAR_RUN_IN_PROGRESS = 'LINEAR_RUN_IN_PROGRESS';
export const LINEAR_MAPPING_PROJECT_FIXED = 'LINEAR_MAPPING_PROJECT_FIXED';
export const LINEAR_CONFLICT_NOT_FOUND = 'LINEAR_CONFLICT_NOT_FOUND';
export const LINEAR_CONFLICT_STALE = 'LINEAR_CONFLICT_STALE';
