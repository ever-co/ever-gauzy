import { IntegrationEnum } from '@gauzy/contracts';

/** The catalogue name of the integration (`integration.name` and `integration_tenant.name`). */
export const JIRA_INTEGRATION_NAME = IntegrationEnum.JIRA;

/**
 * Every route of the plugin hangs off this prefix (under the API's own `/api`). It is the prefix of the Connect
 * descriptor routes too (`jira.controller.ts`), which the always-on `IntegrationJiraPlugin` registers first: none of
 * the routes here is a fixed single segment those routes use (`installed`, `uninstalled`, `issue-created`,
 * `issue-updated`, `issue-deleted`, `atlassian-connect.json`).
 */
export const JIRA_ROUTE_PREFIX = '/integration/jira';

/** The catalogue card: its icon in the seed assets, its order among the cards, and the UI path it opens. */
export const JIRA_CATALOG_ICON = 'jira.svg';
export const JIRA_CATALOG_ORDER = 5;
export const JIRA_REDIRECT_URL = 'jira';

/** Where Atlassian answers. */
export const JIRA_OAUTH_AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
export const JIRA_OAUTH_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
/** The gateway every Jira Cloud site is reached through with an OAuth token (`/ex/jira/<cloudId>/rest/api/3/...`). */
export const JIRA_API_GATEWAY_URL = 'https://api.atlassian.com';
/** The audience of the authorization (the Atlassian API gateway). */
export const JIRA_OAUTH_AUDIENCE = 'api.atlassian.com';
/**
 * What the connection asks for: reading and writing issues, reading the people (the assignee's e-mail), managing the
 * dynamic webhooks of the app, and `offline_access` (a refresh token: the access token lives one hour).
 */
export const JIRA_OAUTH_SCOPES = ['read:jira-work', 'write:jira-work', 'read:jira-user', 'manage:jira-webhook', 'offline_access'];
/** The scope a site must grant for the connection to work with it (accessible-resources lists every product's sites). */
export const JIRA_REQUIRED_SITE_SCOPE = 'read:jira-work';

/** The injection token of the plugin's configuration (`readJiraConfig`). */
export const JIRA_CONFIG = 'JIRA_CONFIG';

/** The `integration_setting` rows of a connected organization. */
export enum JiraSettingName {
	ACCESS_TOKEN = 'access_token',
	/** Renews the access token before it expires (rotated on every renewal: the old one is spent). */
	REFRESH_TOKEN = 'refresh_token',
	TOKEN_TYPE = 'token_type',
	EXPIRES_AT = 'expires_at',
	SCOPE = 'scope',
	/** The Jira Cloud site the connection works with (`accessible-resources`): empty until one is chosen. */
	JIRA_CLOUD_ID = 'jira_cloud_id',
	JIRA_SITE_URL = 'jira_site_url',
	JIRA_SITE_NAME = 'jira_site_name',
	/** The Atlassian account the token is (`/myself`). */
	JIRA_ACCOUNT_ID = 'jira_account_id',
	JIRA_ACCOUNT_NAME = 'jira_account_name',
	/** The Gauzy user who connected: the sync's writes are attributed to them. */
	CONNECTED_BY_USER_ID = 'connected_by_user_id',
	/** Why the connection needs attention (a refused token), or empty. */
	ATTENTION_REASON = 'attention_reason',
	/** When the Inbox notice of the attention was filed (empty: none filed, or resolved). */
	ATTENTION_NOTICE_AT = 'attention_notice_at',
	/** The dynamic webhooks registered for the connection (comma-separated ids), their JQL filter and expiry. */
	WEBHOOK_IDS = 'webhook_ids',
	WEBHOOK_JQL = 'webhook_jql',
	WEBHOOK_EXPIRES_AT = 'webhook_expires_at',
	/** The address the webhook delivers to: a changed address (`JIRA_WEBHOOK_URL`, `API_BASE_URL`) registers it again. */
	WEBHOOK_URL = 'webhook_url',
	/** Why the last registration or refresh of the webhook failed, or empty. */
	WEBHOOK_ERROR = 'webhook_error'
}

/** The largest webhook body accepted. */
export const JIRA_WEBHOOK_MAX_BYTES = 2 * 1024 * 1024;
/** How far a webhook token's `exp` / `iat` may be off the server's clock. */
export const JIRA_WEBHOOK_CLOCK_LEEWAY_SECONDS = 60;
/** How long a delivery id (`X-Atlassian-Webhook-Identifier`) is remembered, so a retried delivery is applied once. */
export const JIRA_WEBHOOK_DEDUPE_MS = 60 * 60 * 1000;
/** The events a connection's dynamic webhook is registered for. */
export const JIRA_WEBHOOK_EVENTS = ['jira:issue_created', 'jira:issue_updated', 'comment_created', 'comment_updated'];
/** Dynamic webhooks expire 30 days after their registration or last refresh: refreshed when this close to it. */
export const JIRA_WEBHOOK_REFRESH_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
/** The life Atlassian gives a dynamic webhook (assumed when the answer names no expiry). */
export const JIRA_WEBHOOK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How many issues one page of an import asks for (each comes with its comments and attachments), and the safety cap
 * of one run (it then records how far it got, and the next run continues from there).
 */
export const JIRA_ISSUES_PAGE_SIZE = 50;
/** An issue's comments beyond those a search answers with it are read in pages of this size, up to the cap. */
export const JIRA_COMMENTS_PAGE_SIZE = 100;
export const JIRA_ISSUE_COMMENTS_MAX = 1_000;
export const JIRA_IMPORT_MAX_ISSUES = 50_000;
/** The import position is the run's start minus this margin: a change made while the pages were read is not skipped next time. */
export const JIRA_IMPORT_CLOCK_SKEW_MS = 60_000;
/** How many failed issues a run's report names (the rest are counted). */
export const JIRA_REPORT_MAX_FAILURES = 50;

/** An access token this close to its expiry is renewed before use. */
export const JIRA_TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000;

/** The queue the scheduled import sweep travels on, the schedule that asks for it, and the queue job it runs as. */
export const JIRA_QUEUE_NAME = 'integration-jira';
export const JIRA_IMPORT_SWEEP_SCHEDULE = 'integration-jira-import-sweep';
export const JIRA_IMPORT_SWEEP_JOB = 'integration-jira.import-due';
/** The default of `JIRA_IMPORT_INTERVAL_MINUTES`: how many minutes apart a mapping's changes are imported. */
export const JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT = 15;
/** How many mappings one sweep imports at most (the longest waiting first; the rest wait for the next sweep). */
export const JIRA_IMPORT_SWEEP_BATCH = 50;
/** A mapping with a live webhook is swept this many intervals apart: a reconcile of missed deliveries, not a second feed. */
export const JIRA_IMPORT_WEBHOOK_STRIDE = 4;
/** A mapping counts as due this long before its interval is up, so one imported right after a sweep does not slip a whole sweep. */
export const JIRA_IMPORT_SWEEP_SLACK_MS = 60_000;
/** How many times the queue tries a sweep that could not run, and the first delay between tries (doubled each time). */
export const JIRA_IMPORT_SWEEP_ATTEMPTS = 3;
export const JIRA_IMPORT_SWEEP_RETRY_DELAY_MS = 30_000;

/** Error codes the routes answer with (`{ message, code }`). */
export const JIRA_NOT_CONFIGURED = 'JIRA_NOT_CONFIGURED';
export const JIRA_NOT_CONNECTED = 'JIRA_NOT_CONNECTED';
export const JIRA_SITE_REQUIRED = 'JIRA_SITE_REQUIRED';
export const JIRA_SITE_NOT_FOUND = 'JIRA_SITE_NOT_FOUND';
/** A connection with mappings keeps its site: a mapping names a project by an id that is only unique on its site. */
export const JIRA_SITE_HAS_MAPPINGS = 'JIRA_SITE_HAS_MAPPINGS';
/** A mapping was asked for on a site the connection no longer works with (it changed while the request ran). */
export const JIRA_SITE_CHANGED = 'JIRA_SITE_CHANGED';
export const JIRA_TOKEN_REFUSED = 'JIRA_TOKEN_REFUSED';
export const JIRA_STATE_INVALID = 'JIRA_STATE_INVALID';
export const JIRA_MAPPING_EXISTS = 'JIRA_MAPPING_EXISTS';
/** Another change of the organization's mappings held the lock too long (MySQL / MariaDB). */
export const JIRA_MAPPINGS_BUSY = 'JIRA_MAPPINGS_BUSY';
export const JIRA_PROJECT_OUTBOUND_TAKEN = 'JIRA_PROJECT_OUTBOUND_TAKEN';
export const JIRA_PROJECT_NOT_FOUND = 'JIRA_PROJECT_NOT_FOUND';
export const JIRA_RUN_IN_PROGRESS = 'JIRA_RUN_IN_PROGRESS';
/** An import was asked of a mapping that brings nothing in (switched off, or outbound only). */
export const JIRA_MAPPING_NOT_INBOUND = 'JIRA_MAPPING_NOT_INBOUND';
export const JIRA_MAPPING_PROJECT_FIXED = 'JIRA_MAPPING_PROJECT_FIXED';
export const JIRA_STATUS_MAP_INVALID = 'JIRA_STATUS_MAP_INVALID';
export const JIRA_CONFLICT_NOT_FOUND = 'JIRA_CONFLICT_NOT_FOUND';
export const JIRA_CONFLICT_STALE = 'JIRA_CONFLICT_STALE';
