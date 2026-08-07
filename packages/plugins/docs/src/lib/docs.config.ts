import {
	DEFAULT_DOCS_CHUNK_OVERLAP_TOKENS,
	DEFAULT_DOCS_CHUNK_TOKENS,
	DEFAULT_DOCS_CLASSIFY_SAMPLE_CHARS,
	DEFAULT_DOCS_EMBED_BATCH_SIZE,
	DEFAULT_DOCS_EMBEDDING_DIMS,
	DEFAULT_DOCS_EMBEDDING_MODEL,
	DEFAULT_DOCS_INBOUND_MAX_MESSAGE_BYTES,
	DEFAULT_DOCS_MAX_BINARY_BYTES,
	DEFAULT_DOCS_MAX_EXTRACTED_CHARS,
	DEFAULT_DOCS_MAX_FILE_SIZE,
	DEFAULT_DOCS_ORG_QUOTA_BYTES,
	DEFAULT_DOCS_QUEUE_CONCURRENCY,
	DEFAULT_DOCS_RETRIEVAL_TOPK_MAX,
	DEFAULT_DOCS_STUCK_THRESHOLD_MINUTES,
	DEFAULT_DOCS_VERSION_DEBOUNCE_MINUTES,
	ENV_GAUZY_DOCS_AI_ENABLED,
	ENV_GAUZY_DOCS_AUTO_REINDEX_ON_MODEL_CHANGE,
	ENV_GAUZY_DOCS_CHUNK_OVERLAP_TOKENS,
	ENV_GAUZY_DOCS_CHUNK_TOKENS,
	ENV_GAUZY_DOCS_CLASSIFY_MODEL,
	ENV_GAUZY_DOCS_CLASSIFY_SAMPLE_CHARS,
	ENV_GAUZY_DOCS_EMBED_BATCH_SIZE,
	ENV_GAUZY_DOCS_EMBEDDING_DIMS,
	ENV_GAUZY_DOCS_EMBEDDING_MODEL,
	ENV_GAUZY_DOCS_INBOUND_DOMAIN,
	ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED,
	ENV_GAUZY_DOCS_INBOUND_MAX_MESSAGE_BYTES,
	ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET,
	ENV_GAUZY_DOCS_MAX_BINARY_BYTES,
	ENV_GAUZY_DOCS_MAX_EXTRACTED_CHARS,
	ENV_GAUZY_DOCS_MAX_FILE_SIZE,
	ENV_GAUZY_DOCS_ORG_QUOTA_BYTES,
	ENV_GAUZY_DOCS_QUEUE_CONCURRENCY,
	ENV_GAUZY_DOCS_RETRIEVAL_LOG_ENABLED,
	ENV_GAUZY_DOCS_RETRIEVAL_TOPK_MAX,
	ENV_GAUZY_DOCS_STUCK_THRESHOLD_MINUTES,
	ENV_GAUZY_DOCS_VECTOR_STORE,
	ENV_GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES
} from './docs.constants';

/**
 * Typed configuration object parsed from the `GAUZY_DOCS_*` environment variables.
 */
export interface IDocsConfig {
	/** Per-file upload size limit in bytes. */
	maxFileSize: number;
	/** Cap on the PAGE `contentBinary` CRDT column in bytes. */
	maxBinaryBytes: number;
	/** Master switch for the AI pipeline (classification, embedding, retrieval). */
	aiEnabled: boolean;
	/** Embedding model id used by the knowledge pipeline. */
	embeddingModel: string;
	/** Classification model id; undefined falls back to the chat default model. */
	classifyModel?: string;
	/** Server-side debounce window for PAGE version snapshots, in minutes. */
	versionDebounceMinutes: number;
	/** `docs-processing` worker concurrency per process. */
	queueConcurrency: number;
	/** Cap on the stored extracted-markdown length, in characters. */
	maxExtractedChars: number;
	/** Recovery-scan staleness threshold for PROCESSING/INDEXING rows, in minutes. */
	stuckThresholdMinutes: number;
	/** Pinned embedding dimensionality — must match the `vector(1536)` column. */
	embeddingDims: number;
	/** Target chunk window in tokens. */
	chunkTokens: number;
	/** Token overlap carried between chunks. */
	chunkOverlapTokens: number;
	/** Head/middle/tail classification sample size in characters. */
	classifySampleChars: number;
	/** Inputs per `embedMany` call (hard max 64). */
	embedBatchSize: number;
	/** Upper bound for `topK` on the knowledge-search endpoint and chat tools. */
	retrievalTopKMax: number;
	/** Auto-sweep re-index on embedding-model drift during the reconcile scan. */
	autoReindexOnModelChange: boolean;
	/** Pinned vector-store provider id; undefined = best available (pgvector → lexical). */
	vectorStore?: string;
	/**
	 * Deployment default for the per-organization storage quota, in bytes.
	 * `0` (the default) = unlimited. Overridden per org by `docs.<orgId>.quotaBytes`.
	 */
	orgQuotaBytes: number;
	/** Kill-switch for the structured retrieval/AI-usage telemetry lines (§16). */
	retrievalLogEnabled: boolean;
	/** Master switch for the inbound-email capture webhook (§17.2) — off unless explicitly true. */
	inboundEmailEnabled: boolean;
	/** Shared secret of the generic signed-webhook reference adapter (HMAC-SHA256). */
	inboundWebhookSecret?: string;
	/** Per-message size cap for the inbound-email webhook, in bytes. */
	inboundMaxMessageBytes: number;
	/** Capture-address domain (`docs-<token>@<domain>`) — informational, reported in settings. */
	inboundDomain?: string;
}

/**
 * Parses an integer environment variable with a fallback default.
 *
 * @param key The environment variable name.
 * @param fallback The default used when the variable is absent or not a number.
 * @returns The parsed integer value.
 */
const parseIntEnv = (key: string, fallback: number): number => {
	const raw = process.env[key];
	const parsed = raw ? Number.parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Parses a NON-NEGATIVE integer environment variable — unlike `parseIntEnv`, an explicit
 * `0` is a meaningful value here (quota `0` = unlimited) and must survive parsing.
 *
 * @param key The environment variable name.
 * @param fallback The default used when the variable is absent or not a number.
 * @returns The parsed integer value (>= 0).
 */
const parseNonNegativeIntEnv = (key: string, fallback: number): number => {
	const raw = process.env[key];
	const parsed = raw ? Number.parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * Parses a boolean environment variable with a fallback default.
 *
 * @param key The environment variable name.
 * @param fallback The default used when the variable is absent.
 * @returns The parsed boolean value.
 */
const parseBoolEnv = (key: string, fallback: boolean): boolean => {
	const raw = process.env[key];
	if (raw === undefined || raw === '') {
		return fallback;
	}
	return ['true', '1', 'yes'].includes(raw.toLowerCase());
};

/**
 * Reads the `GAUZY_DOCS_*` environment variables into a typed config object.
 * All variables are optional; documented defaults apply.
 *
 * @returns The resolved Documents plugin configuration.
 */
export const getDocsConfig = (): IDocsConfig => ({
	maxFileSize: parseIntEnv(ENV_GAUZY_DOCS_MAX_FILE_SIZE, DEFAULT_DOCS_MAX_FILE_SIZE),
	maxBinaryBytes: parseIntEnv(ENV_GAUZY_DOCS_MAX_BINARY_BYTES, DEFAULT_DOCS_MAX_BINARY_BYTES),
	aiEnabled: parseBoolEnv(ENV_GAUZY_DOCS_AI_ENABLED, false),
	embeddingModel: process.env[ENV_GAUZY_DOCS_EMBEDDING_MODEL] || DEFAULT_DOCS_EMBEDDING_MODEL,
	classifyModel: process.env[ENV_GAUZY_DOCS_CLASSIFY_MODEL] || undefined,
	versionDebounceMinutes: parseIntEnv(ENV_GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES, DEFAULT_DOCS_VERSION_DEBOUNCE_MINUTES),
	queueConcurrency: parseIntEnv(ENV_GAUZY_DOCS_QUEUE_CONCURRENCY, DEFAULT_DOCS_QUEUE_CONCURRENCY),
	maxExtractedChars: parseIntEnv(ENV_GAUZY_DOCS_MAX_EXTRACTED_CHARS, DEFAULT_DOCS_MAX_EXTRACTED_CHARS),
	stuckThresholdMinutes: parseIntEnv(ENV_GAUZY_DOCS_STUCK_THRESHOLD_MINUTES, DEFAULT_DOCS_STUCK_THRESHOLD_MINUTES),
	embeddingDims: parseIntEnv(ENV_GAUZY_DOCS_EMBEDDING_DIMS, DEFAULT_DOCS_EMBEDDING_DIMS),
	chunkTokens: parseIntEnv(ENV_GAUZY_DOCS_CHUNK_TOKENS, DEFAULT_DOCS_CHUNK_TOKENS),
	chunkOverlapTokens: parseIntEnv(ENV_GAUZY_DOCS_CHUNK_OVERLAP_TOKENS, DEFAULT_DOCS_CHUNK_OVERLAP_TOKENS),
	classifySampleChars: parseIntEnv(ENV_GAUZY_DOCS_CLASSIFY_SAMPLE_CHARS, DEFAULT_DOCS_CLASSIFY_SAMPLE_CHARS),
	// Hard max 64 — provider batch APIs and the cost model both assume it.
	embedBatchSize: Math.min(parseIntEnv(ENV_GAUZY_DOCS_EMBED_BATCH_SIZE, DEFAULT_DOCS_EMBED_BATCH_SIZE), 64),
	retrievalTopKMax: parseIntEnv(ENV_GAUZY_DOCS_RETRIEVAL_TOPK_MAX, DEFAULT_DOCS_RETRIEVAL_TOPK_MAX),
	autoReindexOnModelChange: parseBoolEnv(ENV_GAUZY_DOCS_AUTO_REINDEX_ON_MODEL_CHANGE, false),
	vectorStore: process.env[ENV_GAUZY_DOCS_VECTOR_STORE] || undefined,
	// 0 must survive as "unlimited" — hence the non-negative parser.
	orgQuotaBytes: parseNonNegativeIntEnv(ENV_GAUZY_DOCS_ORG_QUOTA_BYTES, DEFAULT_DOCS_ORG_QUOTA_BYTES),
	retrievalLogEnabled: parseBoolEnv(ENV_GAUZY_DOCS_RETRIEVAL_LOG_ENABLED, true),
	inboundEmailEnabled: parseBoolEnv(ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED, false),
	inboundWebhookSecret: process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET] || undefined,
	inboundMaxMessageBytes: parseIntEnv(
		ENV_GAUZY_DOCS_INBOUND_MAX_MESSAGE_BYTES,
		DEFAULT_DOCS_INBOUND_MAX_MESSAGE_BYTES
	),
	inboundDomain: process.env[ENV_GAUZY_DOCS_INBOUND_DOMAIN] || undefined
});
