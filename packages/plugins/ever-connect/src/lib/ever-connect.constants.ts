// cspell:ignore Crockford HJKMNP
/**
 * The constants of the Ever Platform connection, in one place.
 */

/** Injection token: the environment the module reads (tests pass their own; default `process.env`). */
export const EVER_CONNECT_ENV = 'EVER_CONNECT_ENV';

/** Injection token: the settings read once from the environment ({@link EverConnectConfig}). */
export const EVER_CONNECT_SETTINGS = 'EVER_CONNECT_SETTINGS';

/** Injection token: the clock (tests pass their own). */
export const EVER_CONNECT_CLOCK = 'EVER_CONNECT_CLOCK';

/** Injection token: the `fetch` the Ever Platform client uses (tests pass a recording one). */
export const EVER_CONNECT_FETCH = 'EVER_CONNECT_FETCH';

/** The default Ever Platform API origin. */
export const DEFAULT_PLATFORM_API_URL = 'https://api.ever.co';

/** The version of this module (equals `package.json` `version`; a spec pins it). */
export const MODULE_VERSION = '0.1.0';

/** The product this installation runs, as Ever Platform names it. */
export const PRODUCT = 'gauzy';

/** The id of the only row of `ever_connect_connection`. */
export const CONNECTION_ROW_ID = 'self';

/** `integration_tenant.name` of a tenant link (the `IntegrationEnum.EVER_CONNECT` value). */
export const LINK_INTEGRATION_NAME = 'Ever_Connect';

/** A connect code: `EVC-XXXX-XXXX-XXXX` in Crockford base32 (no I, L, O, U), any case. */
export const CONNECT_CODE_SHAPE = /^EVC(-[0-9A-HJKMNP-TV-Z]{4}){3}$/i;

/** A link code: `EVL-XXXX-XXXX-XXXX`. */
export const LINK_CODE_SHAPE = /^EVL(-[0-9A-HJKMNP-TV-Z]{4}){3}$/i;

/** A Registry id (ULID). */
export const ULID_SHAPE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** A key id: base64url of the first 8 bytes of SHA-256 over the public key, 11 characters. */
export const KID_SHAPE = /^[A-Za-z0-9_-]{11}$/;

/** The longest event feed cursor kept (`feedCursor`). */
export const MAX_FEED_CURSOR_LENGTH = 64;

/**
 * The integrations that act for the whole installation rather than one linked organization. Only
 * the operator of the installation asks for their consent link and accepts them locally.
 */
export const INSTANCE_WIDE_KEYS: ReadonlyArray<string> = Object.freeze([
	'instance_url',
	'stats_link',
	'ever_id_login',
	'webhooks'
]);

/** Whether `key` is an installation-wide integration. */
export const isInstanceWideKey = (key: string): boolean => INSTANCE_WIDE_KEYS.includes(key);

/** The local states of an integration. */
export const INTEGRATION_STATES = Object.freeze([
	'available',
	'enabled',
	'disabled',
	'denied_by_policy',
	'revoked_remote',
	'coming_soon',
	'pending_operator'
] as const);
export type IntegrationLocalState = (typeof INTEGRATION_STATES)[number];

/** Who switched an integration off. */
export type RevokeSource = 'instance' | 'platform' | 'env' | 'policy' | 'operator';

/** The connection states. */
export type ConnectionStatus = 'connected' | 'pending_approval' | 'revoked' | 'disconnected';

/** Heartbeat: the first at most 5 minutes after start, then every 24 hours. */
export const FIRST_HEARTBEAT_DELAY_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The event feed: a long poll of 25 seconds, or one read every 15 minutes. */
export const FEED_WAIT_S = 25;
export const FEED_INTERVAL_MS = 15 * 60 * 1000;
/** After a failed feed read, the next one waits this long (then doubles, at most the interval). */
export const FEED_RETRY_MS = 30_000;

/** The lease that lets one API process (of several on one database) run the heartbeat and the feed. */
export const LEASE_MS = 2 * 60 * 1000;

/** On-demand entitlement refreshes: at most 6 an hour. */
export const ENTITLEMENT_REFRESHES_PER_HOUR = 6;

/** The best-effort disconnect call waits at most 10 seconds. */
export const DISCONNECT_TIMEOUT_MS = 10_000;

/** `EVER_CONNECT_CODE` after a network failure: retried with these waits, then every 24 hours. */
export const ENV_CODE_RETRY_MS = Object.freeze([
	60_000,
	5 * 60_000,
	30 * 60_000,
	2 * 3_600_000,
	6 * 3_600_000,
	24 * 3_600_000
]);
