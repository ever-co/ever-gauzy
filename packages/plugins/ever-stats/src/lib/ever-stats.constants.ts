/**
 * The wire contract of the anonymous usage statistics (`ever.stats.v1`), in one place.
 */

/** The one outbound call of this plugin: `POST {EVER_STATS_API_URL}/v1/stats/reports`. */
export const STATS_REPORTS_PATH = '/v1/stats/reports';

/** The default Ever Platform API origin. */
export const DEFAULT_STATS_API_URL = 'https://api.ever.co';

/**
 * The report endpoint's signature headers (the statistics public key, the signature, the key id),
 * the signature prefix and the largest report body, from the SDK.
 */
export { MAX_STATS_REPORT_BYTES, STATS_HEADERS, STATS_SIGNATURE_PREFIX } from '@ever-co/connect-sdk';

/** The schema id every report carries. */
export const STATS_SCHEMA_ID = 'ever.stats.v1';

/** The version of this module, sent as `module_version` (equals `package.json` `version`; a spec pins it). */
export const MODULE_VERSION = '0.1.0';

/** The request timeout of a send. */
export const STATS_SEND_TIMEOUT_MS = 10_000;

/** The waits after a failed send (429, 5xx, no answer): +1 h, +4 h, +12 h, then the next day. */
export const STATS_RETRY_DELAYS_S = Object.freeze([3600, 14400, 43200, 86400]);

/** How many report rows are kept. */
export const STATS_REPORTS_KEPT = 12;

/** "Send now" may be used once per 10 minutes. */
export const STATS_SEND_NOW_INTERVAL_MS = 10 * 60 * 1000;

/** The sending lease lasts 15 minutes. */
export const STATS_LEASE_MS = 15 * 60 * 1000;

/**
 * The published schema, for operators and reviewers: the file in the public Ever Platform SDK
 * repository, at the commit this plugin's copy (`src/lib/schema/`) was taken from.
 */
export const STATS_SCHEMA_URL =
	'https://github.com/ever-co/ever-connect-sdk/blob/d75f380b78a368910651a3438a6577d4dd9dce9d/contracts/schemas/ever.stats.v1.json';

/** The largest answer body read from Ever Platform; a longer one is not read further. */
export const MAX_STATS_RESPONSE_BYTES = 64 * 1024;

/**
 * How long a report refused as malformed (`400`, `413`, `415`) keeps the module from sending, unless
 * the module, the Gauzy release or the identity changes first. A schema refusal (`422`) or another
 * key for the id (`409 key_mismatch`) keeps it until one of those changes.
 */
export const STATS_REFUSAL_PARK_MS = 7 * 24 * 60 * 60 * 1000;

/** "What is sent" builds the report at most once a minute per API process; within it the last one is shown again. */
export const STATS_PREVIEW_INTERVAL_MS = 60 * 1000;
