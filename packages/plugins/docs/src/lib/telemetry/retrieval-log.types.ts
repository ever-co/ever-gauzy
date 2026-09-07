import { ID } from '@gauzy/contracts';

/**
 * Telemetry groundwork for `07-ai-knowledge.md` §16.
 *
 * P1 ships the **seam plus a structured-logger implementation** — no tables, no migrations.
 * P2 replaces the provider bound to `DOCS_RETRIEVAL_LOG` with the `document_retrieval_log` /
 * `document_citation` table-backed writer; nothing at the call sites changes because the
 * call sites only ever see this interface.
 *
 * Two invariants hold for every implementation:
 *
 * 1. **Never slow or fail a search** — every method is fire-and-forget and returns `void`;
 *    an implementation that throws is a bug, and the call sites additionally guard.
 * 2. **Never record content** — no query text, no document names, no chunk text. Tenant and
 *    organization identifiers are one-way hashed; only the query *length* is recorded.
 */

/** DI token the retrieval + AI call sites resolve the log through (swappable in P2). */
export const DOCS_RETRIEVAL_LOG = 'DOCS_RETRIEVAL_LOG';

/** The consumer surface that issued a retrieval (§16.1). */
export type DocsRetrievalConsumerKind = 'knowledge-search' | 'chat-tool' | 'attach-picker';

/** Which retrieval legs actually ran — the degradation ladder position (§10). */
export type DocsRetrievalMode = 'hybrid' | 'lexical-only';

/** One retrieval event as the log sees it. Content-free by construction. */
export interface IDocsRetrievalLogEvent {
	/** Raw tenant id — implementations MUST hash it before emitting. */
	tenantId?: ID | null;
	/** Raw organization id — implementations MUST hash it before emitting. */
	organizationId?: ID | null;
	/** The consumer surface. */
	consumerKind: DocsRetrievalConsumerKind;
	/** Character length of the query — never the query itself. */
	queryLength: number;
	/** Number of fused hits returned (0 is the knowledge-gap signal). */
	resultCount: number;
	/** Distinct parent documents among the hits. */
	documentCount: number;
	/** End-to-end retrieval latency in milliseconds. */
	latencyMs: number;
	/** Which legs ran. */
	mode: DocsRetrievalMode;
	/** Fused best score, when there was a hit. */
	topScore?: number | null;
	/** Whether the low-confidence caveat was raised. */
	lowConfidence?: boolean;
	/** The vector-store provider that served the vector leg, when one ran. */
	storeId?: string | null;
}

/** One AI-usage event as the log sees it (mirrors `DocsAiUsageEvent['payload']`). */
export interface IDocsAiUsageLogEvent {
	tenantId?: ID | null;
	organizationId?: ID | null;
	feature: string;
	providerId: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	estimated: boolean;
	durationMs: number;
	success: boolean;
}

/**
 * The swappable telemetry sink. Bind an implementation to `DOCS_RETRIEVAL_LOG`.
 */
export interface IDocsRetrievalLog {
	/** Stable implementation id, for the "which sink is active" debug line. */
	readonly id: string;
	/** Records one retrieval event. Fire-and-forget — must never throw. */
	recordRetrieval(event: IDocsRetrievalLogEvent): void;
	/** Records one AI usage event. Fire-and-forget — must never throw. */
	recordAiUsage(event: IDocsAiUsageLogEvent): void;
}
