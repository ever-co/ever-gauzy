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
