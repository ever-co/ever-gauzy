/**
 * Stable machine error codes for the Documents plugin.
 *
 * Every thrown `HttpException` carries `{ statusCode, message, code }` where `code` is one of
 * these constants — the frontend maps codes to i18n keys.
 */
export const DOCS_FILE_VIA_UPLOAD = 'DOCS_FILE_VIA_UPLOAD';
export const DOCS_PARENT_NOT_CONTAINER = 'DOCS_PARENT_NOT_CONTAINER';
export const DOCS_CONTENT_JSON_REQUIRED = 'DOCS_CONTENT_JSON_REQUIRED';
export const DOCS_CONTENT_CONFLICT = 'DOCS_CONTENT_CONFLICT';
export const DOCS_LOCKED = 'DOCS_LOCKED';
export const DOCS_EXTRACTED_TEXT_EDITED = 'DOCS_EXTRACTED_TEXT_EDITED';
export const DOCS_TREE_CYCLE = 'DOCS_TREE_CYCLE';
export const DOCS_REORDER_MIXED_PARENTS = 'DOCS_REORDER_MIXED_PARENTS';
export const DOCS_DELETE_REQUIRES_ARCHIVE = 'DOCS_DELETE_REQUIRES_ARCHIVE';
export const DOCS_NOT_A_FILE = 'DOCS_NOT_A_FILE';
export const DOCS_NOT_A_PAGE = 'DOCS_NOT_A_PAGE';
export const DOCS_NOT_READY = 'DOCS_NOT_READY';
export const DOCS_REVIEW_NOT_PENDING = 'DOCS_REVIEW_NOT_PENDING';
export const DOCS_QUERY_TOO_SHORT = 'DOCS_QUERY_TOO_SHORT';
export const DOCS_SOURCE_RESERVED = 'DOCS_SOURCE_RESERVED';
export const DOCS_FILE_TOO_LARGE = 'DOCS_FILE_TOO_LARGE';
export const DOCS_FILE_TYPE_REJECTED = 'DOCS_FILE_TYPE_REJECTED';
export const DOCS_CATEGORY_EXISTS = 'DOCS_CATEGORY_EXISTS';
export const DOCS_CATEGORY_SYSTEM = 'DOCS_CATEGORY_SYSTEM';
export const DOCS_SHARE_TARGET = 'DOCS_SHARE_TARGET';
export const DOCS_SHARE_NOT_PRIVATE = 'DOCS_SHARE_NOT_PRIVATE';
export const DOCS_BULK_ACTION_UNSUPPORTED = 'DOCS_BULK_ACTION_UNSUPPORTED';
export const DOCS_NOT_INDEXABLE = 'DOCS_NOT_INDEXABLE';
/** A share row for the same (document, employee|team) target already exists. */
export const DOCS_SHARE_EXISTS = 'DOCS_SHARE_EXISTS';
/** The caller is neither the document's creator nor a `DOCS_MANAGE` holder. */
export const DOCS_SHARE_FORBIDDEN = 'DOCS_SHARE_FORBIDDEN';
/** The caller may read the document but holds no write right on it (§3.4 ownership / `EDIT` share). */
export const DOCS_WRITE_FORBIDDEN = 'DOCS_WRITE_FORBIDDEN';
/** No organization scope could be resolved for the request (neither payload nor request context). */
export const DOCS_ORGANIZATION_REQUIRED = 'DOCS_ORGANIZATION_REQUIRED';
/** A `subtree` delete was requested while some descendants are still live (not archived). */
export const DOCS_SUBTREE_NOT_ARCHIVED = 'DOCS_SUBTREE_NOT_ARCHIVED';
/** A bulk `MOVE` was requested without an explicit `parentId` (`null` = root is an opt-in). */
export const DOCS_BULK_MOVE_PARENT_REQUIRED = 'DOCS_BULK_MOVE_PARENT_REQUIRED';
/** The organization storage quota would be exceeded by this upload. */
export const DOCS_QUOTA_EXCEEDED = 'DOCS_QUOTA_EXCEEDED';
/** The inbound-email webhook is not enabled in this deployment. */
export const DOCS_INBOUND_DISABLED = 'DOCS_INBOUND_DISABLED';
/** The inbound-email webhook signature did not verify. */
export const DOCS_INBOUND_SIGNATURE_INVALID = 'DOCS_INBOUND_SIGNATURE_INVALID';
/** No organization owns the recipient capture token. */
export const DOCS_INBOUND_UNKNOWN_RECIPIENT = 'DOCS_INBOUND_UNKNOWN_RECIPIENT';
/** The inbound message exceeded the configured per-message size cap. */
export const DOCS_INBOUND_TOO_LARGE = 'DOCS_INBOUND_TOO_LARGE';
/** The inbound message carried no importable attachment. */
export const DOCS_INBOUND_NO_ATTACHMENTS = 'DOCS_INBOUND_NO_ATTACHMENTS';

/**
 * Environment variable keys read by `docs.config.ts`.
 */
export const ENV_GAUZY_DOCS_MAX_FILE_SIZE = 'GAUZY_DOCS_MAX_FILE_SIZE';
export const ENV_GAUZY_DOCS_MAX_BINARY_BYTES = 'GAUZY_DOCS_MAX_BINARY_BYTES';
export const ENV_GAUZY_DOCS_AI_ENABLED = 'GAUZY_DOCS_AI_ENABLED';
export const ENV_GAUZY_DOCS_EMBEDDING_MODEL = 'GAUZY_DOCS_EMBEDDING_MODEL';
export const ENV_GAUZY_DOCS_CLASSIFY_MODEL = 'GAUZY_DOCS_CLASSIFY_MODEL';
export const ENV_GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES = 'GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES';
export const ENV_GAUZY_DOCS_QUEUE_CONCURRENCY = 'GAUZY_DOCS_QUEUE_CONCURRENCY';
/**
 * Master switch for BullMQ-backed pipeline dispatch. Unset, it follows `REDIS_ENABLED` —
 * the exact signal `@gauzy/scheduler` uses for its own `enableQueueing` default, so the
 * plugin registers its queue + worker host precisely when a Bull root could exist.
 * When off, the pipeline runs inline (see `DocsQueueService`).
 */
export const ENV_GAUZY_DOCS_QUEUE_ENABLED = 'GAUZY_DOCS_QUEUE_ENABLED';
export const ENV_GAUZY_DOCS_MAX_EXTRACTED_CHARS = 'GAUZY_DOCS_MAX_EXTRACTED_CHARS';
export const ENV_GAUZY_DOCS_STUCK_THRESHOLD_MINUTES = 'GAUZY_DOCS_STUCK_THRESHOLD_MINUTES';
export const ENV_GAUZY_DOCS_EMBEDDING_DIMS = 'GAUZY_DOCS_EMBEDDING_DIMS';
export const ENV_GAUZY_DOCS_CHUNK_TOKENS = 'GAUZY_DOCS_CHUNK_TOKENS';
export const ENV_GAUZY_DOCS_CHUNK_OVERLAP_TOKENS = 'GAUZY_DOCS_CHUNK_OVERLAP_TOKENS';
export const ENV_GAUZY_DOCS_CLASSIFY_SAMPLE_CHARS = 'GAUZY_DOCS_CLASSIFY_SAMPLE_CHARS';
export const ENV_GAUZY_DOCS_EMBED_BATCH_SIZE = 'GAUZY_DOCS_EMBED_BATCH_SIZE';
export const ENV_GAUZY_DOCS_RETRIEVAL_TOPK_MAX = 'GAUZY_DOCS_RETRIEVAL_TOPK_MAX';
export const ENV_GAUZY_DOCS_AUTO_REINDEX_ON_MODEL_CHANGE = 'GAUZY_DOCS_AUTO_REINDEX_ON_MODEL_CHANGE';
export const ENV_GAUZY_DOCS_VECTOR_STORE = 'GAUZY_DOCS_VECTOR_STORE';
export const ENV_GAUZY_DOCS_ORG_QUOTA_BYTES = 'GAUZY_DOCS_ORG_QUOTA_BYTES';
export const ENV_GAUZY_DOCS_RETRIEVAL_LOG_ENABLED = 'GAUZY_DOCS_RETRIEVAL_LOG_ENABLED';
export const ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED = 'GAUZY_DOCS_INBOUND_EMAIL_ENABLED';
export const ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET = 'GAUZY_DOCS_INBOUND_WEBHOOK_SECRET';
export const ENV_GAUZY_DOCS_INBOUND_MAX_MESSAGE_BYTES = 'GAUZY_DOCS_INBOUND_MAX_MESSAGE_BYTES';
export const ENV_GAUZY_DOCS_INBOUND_DOMAIN = 'GAUZY_DOCS_INBOUND_DOMAIN';

/**
 * Defaults for the environment variables above.
 */
export const DEFAULT_DOCS_MAX_FILE_SIZE = 52428800; // 50 MB
export const DEFAULT_DOCS_MAX_BINARY_BYTES = 10485760; // 10 MB
export const DEFAULT_DOCS_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_DOCS_VERSION_DEBOUNCE_MINUTES = 10;
export const DEFAULT_DOCS_QUEUE_CONCURRENCY = 2;
export const DEFAULT_DOCS_MAX_EXTRACTED_CHARS = 5000000; // 5 MB of markdown
export const DEFAULT_DOCS_STUCK_THRESHOLD_MINUTES = 30;
export const DEFAULT_DOCS_EMBEDDING_DIMS = 1536;
export const DEFAULT_DOCS_CHUNK_TOKENS = 512;
export const DEFAULT_DOCS_CHUNK_OVERLAP_TOKENS = 64;
export const DEFAULT_DOCS_CLASSIFY_SAMPLE_CHARS = 4000;
/** Default AND hard max — the embed stage clamps any configured value to 64. */
export const DEFAULT_DOCS_EMBED_BATCH_SIZE = 64;
export const DEFAULT_DOCS_RETRIEVAL_TOPK_MAX = 12;
export const DEFAULT_DOCS_RETRIEVAL_TOPK = 6;
/** 0 = unlimited organization storage (the documented default). */
export const DEFAULT_DOCS_ORG_QUOTA_BYTES = 0;
/** Per-message cap for the inbound-email webhook (25 MB). */
export const DEFAULT_DOCS_INBOUND_MAX_MESSAGE_BYTES = 26214400;

/**
 * Maximum number of ids accepted by the bulk endpoint.
 */
export const DOCS_BULK_MAX_IDS = 200;

/**
 * Maximum number of files accepted per upload request.
 */
export const DOCS_UPLOAD_MAX_FILES = 10;

/**
 * BullMQ enqueue options for every `docs-processing` pipeline job:
 * 1 initial attempt + 2 retries with exponential backoff from a 120 s base (≈2/4-minute delays).
 */
export const DOCS_JOB_ATTEMPTS = 3;
export const DOCS_JOB_BACKOFF_DELAY_MS = 120_000;
export const DOCS_JOB_REMOVE_ON_COMPLETE = 500;
export const DOCS_JOB_REMOVE_ON_FAIL = 1000;

/**
 * Startup-recovery / reconcile sweep timing (§7.5 of the backend spec).
 */
export const DOCS_RECOVERY_STARTUP_DELAY_MS = 15_000; // settle delay after boot
export const DOCS_RECOVERY_UPLOADED_STALE_MINUTES = 5; // UPLOADED older than this with no job → re-enqueue
export const DOCS_RECOVERY_FAILED_AFTER_HOURS = 24; // PROCESSING stuck longer than this → FAILED

/**
 * Namespace prefix for the org-defaults settings persisted as `tenant_setting` rows
 * (`docs.<organizationId>.<key>`).
 */
export const DOCS_SETTING_PREFIX = 'docs';

/**
 * Org-setting keys (namespaced under `docs.<organizationId>.`) owned by the M5 features:
 * the storage-quota override and the inbound-email capture token.
 */
export const DOCS_SETTING_QUOTA_BYTES = 'quotaBytes';
export const DOCS_SETTING_INBOUND_TOKEN = 'inboundToken';

/**
 * Replay window for the generic signed inbound-email webhook adapter — a signed request
 * older than this is rejected even when its HMAC verifies.
 */
export const DOCS_INBOUND_SIGNATURE_TOLERANCE_MS = 300_000; // 5 minutes

/** Header names read by the generic signed-webhook reference adapter. */
export const DOCS_INBOUND_SIGNATURE_HEADER = 'x-gauzy-docs-signature';
export const DOCS_INBOUND_TIMESTAMP_HEADER = 'x-gauzy-docs-timestamp';
