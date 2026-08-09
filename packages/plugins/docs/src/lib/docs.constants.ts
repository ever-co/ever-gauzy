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
/** The submitted `contentJson` is not a schema-valid TipTap document (`08` §6.1). */
export const DOCS_CONTENT_SCHEMA_INVALID = 'DOCS_CONTENT_SCHEMA_INVALID';
/** The submitted `contentBinary` exceeds `GAUZY_DOCS_MAX_BINARY_BYTES` (`10` §7.1 P6). */
export const DOCS_CONTENT_BINARY_TOO_LARGE = 'DOCS_CONTENT_BINARY_TOO_LARGE';

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
 * Master switch for BullMQ-backed pipeline dispatch. Off unless explicitly set.
 *
 * 🛑 Only turn this on in a process that registers a `BullModule.forRoot()` connection — Redis
 * being reachable is not enough. Without a root, `@nestjs/bullmq` throws
 * `Worker requires a connection` while building the `@Processor` and the whole API fails to
 * boot. When off, the pipeline runs inline (see `DocsQueueService`).
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
/**
 * Master switch for provider-vision OCR (scanned PDFs + images). Off by default: OCR is a
 * per-page LLM call, so it is opt-in spend. When off, a PDF with no usable text layer and an
 * image upload both fail permanently exactly as they did before OCR existed.
 */
export const ENV_GAUZY_DOCS_OCR_ENABLED = 'GAUZY_DOCS_OCR_ENABLED';
/** Hard cap on OCR'd pages per document — the cost fuse of the OCR path. */
export const ENV_GAUZY_DOCS_OCR_MAX_PAGES = 'GAUZY_DOCS_OCR_MAX_PAGES';
/**
 * Per-route rate limits (`08-permissions-security.md` §9), in requests per minute. They are
 * applied as named `@Throttle` overrides on the abuse-relevant routes only — plain CRUD reads
 * stay on the platform's global defaults.
 */
export const ENV_GAUZY_DOCS_UPLOAD_RATE_LIMIT = 'GAUZY_DOCS_UPLOAD_RATE_LIMIT';
export const ENV_GAUZY_DOCS_SEARCH_RATE_LIMIT = 'GAUZY_DOCS_SEARCH_RATE_LIMIT';
export const ENV_GAUZY_DOCS_ADMIN_OPS_RATE_LIMIT = 'GAUZY_DOCS_ADMIN_OPS_RATE_LIMIT';
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
/** OCR page cap per document (07 §4 row 2) — pages beyond it are dropped with a visible note. */
export const DEFAULT_DOCS_OCR_MAX_PAGES = 20;
/** Per-message cap for the inbound-email webhook (25 MB). */
export const DEFAULT_DOCS_INBOUND_MAX_MESSAGE_BYTES = 26214400;
/** Requests/minute on the intake path — upload costs storage + pipeline + AI spend (§9). */
export const DEFAULT_DOCS_UPLOAD_RATE_LIMIT = 20;
/** Requests/minute on knowledge search — every query fans out to a query embedding (§9). */
export const DEFAULT_DOCS_SEARCH_RATE_LIMIT = 60;
/** Requests/minute on the fan-out admin operations (bulk actions, per-document re-index) (§9). */
export const DEFAULT_DOCS_ADMIN_OPS_RATE_LIMIT = 10;

/**
 * Window the per-route rate limits are expressed over, in milliseconds.
 *
 * 🛑 A contract with `docs.constants`' `*_RATE_LIMIT` values, which the spec states in
 * **requests per minute** — changing this without restating the limits silently rescales all
 * three of them.
 */
export const DOCS_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Minimum `q` length accepted by a content search (`searchIn=content`) on the documents
 * list — shorter queries are rejected with 400 `DOCS_QUERY_TOO_SHORT`.
 *
 * 🛑 **This number is a contract, not a tuning knob.** A 1–2 character substring makes every
 * `contentHtml`/`extractedText` row a candidate for a result set nobody can use, so the server
 * refuses it. `01-ux-spec.md` §5 states the same 3, and the client mirrors it verbatim in
 * `DOCUMENT_CONTENT_SEARCH_MIN_CHARS` / `DOCS_CONTENT_SEARCH_MIN_CHARS`
 * (`@gauzy/plugin-docs-ui`) — its search gate, its tooltip and this guard must agree, or the
 * UI invites a query the API rejects.
 */
export const DOCS_CONTENT_SEARCH_MIN_CHARS = 3;

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
 * How many AI-heavy stages (`docs.classify`, `docs.embed`) one tenant may hold on a worker at a
 * time (`07-ai-knowledge.md` §3.1/§15 — "serialized per tenant").
 *
 * The worker concurrency (`GAUZY_DOCS_QUEUE_CONCURRENCY`) is a *process* budget and knows nothing
 * about who queued the work: without this cap one tenant's 500-file import fills every slot and
 * every other tenant's classification waits behind it — and, worse, monopolizes the shared
 * provider rate limit. A tenant at the cap does not block the worker: its job is moved back to
 * the delayed set (never failed, never dropped) so the slot goes to somebody else.
 */
export const DOCS_TENANT_AI_CONCURRENCY = 1;

/**
 * How long a `docs.classify` / `docs.embed` job waits before it is retried when its tenant is
 * already at {@link DOCS_TENANT_AI_CONCURRENCY}.
 *
 * Short enough that a single-tenant deployment (the common case) barely notices the hand-off,
 * long enough that a 500-job import does not re-enter the worker in a hot loop.
 */
export const DOCS_TENANT_BUSY_DEFER_DELAY_MS = 5_000;

/**
 * BullMQ `priority` of pipeline jobs sourced from a bulk import (`reason: 'import'`).
 *
 * Higher number = lower priority in BullMQ, and un-prioritized jobs (`priority` unset) are served
 * first — so interactive work (an upload, a page save, an explicit re-index) overtakes a bulk
 * import that is already in the queue. Matches the value the model-drift sweep uses.
 */
export const DOCS_BULK_IMPORT_JOB_PRIORITY = 10;

/**
 * How long a resolved `FEATURE_DOCUMENTS` answer is memoized per tenant/organization, so a burst
 * of pipeline stages costs one flag lookup instead of one per stage. Short on purpose: turning
 * the feature back on should un-park the pipeline within a minute, not a deploy.
 */
export const DOCS_FEATURE_CACHE_TTL_MS = 60_000;

/**
 * How long a pipeline stage is parked when `FEATURE_DOCUMENTS` is disabled for its tenant.
 *
 * 🛑 The stage is **re-queued with this delay, never dropped**. A document that was mid-pipeline
 * when an admin turned the feature off must resume — not silently stay `UPLOADED` forever — the
 * moment it is turned back on. One delayed job per stage+document is the whole cost of waiting.
 */
export const DOCS_FEATURE_DISABLED_PARK_DELAY_MS = 900_000; // 15 minutes

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
