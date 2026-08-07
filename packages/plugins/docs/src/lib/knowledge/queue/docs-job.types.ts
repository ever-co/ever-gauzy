import { ID } from '@gauzy/contracts';

/**
 * Why a pipeline job was enqueued. `chunk`/`index` branch on it; every other stage logs it.
 */
export type DocsJobReason =
	| 'upload'
	| 'replace'
	| 'import'
	| 'reindex'
	| 'recovery'
	| 'content-changed'
	| 'model-changed'
	| 'extracted-text-edited';

/**
 * Base payload of every `docs-processing` job.
 *
 * All payloads carry an **explicit tenant/organization snapshot** — `RequestContext`
 * (CLS-based) is NOT available on queue threads; every repository call inside a handler
 * uses the snapshot in explicit `where` clauses. This is a hard rule.
 */
export interface IDocsJobBase {
	documentId: ID;
	/** Snapshot — NEVER read from `RequestContext` in a handler. */
	tenantId: ID;
	/** Snapshot. */
	organizationId: ID;
	/** Why this job was enqueued. */
	reason: DocsJobReason;
	/** For activity-log attribution; absent for system-initiated runs. */
	initiatedByUserId?: ID;
}

/** Payload of `docs.extract`. */
export interface IDocsExtractJob extends IDocsJobBase {
	/** True = skip extraction AND classification, go straight to `docs.chunk` (human-correction guard). */
	keepExtractedText?: boolean;
	/** P1 (M5) — bypass the text-layer fast path (PDF/images). */
	forceOcr?: boolean;
}

/** Payload of `docs.classify`. */
export interface IDocsClassifyJob extends IDocsJobBase {}

/** Payload of `docs.chunk`. */
export interface IDocsChunkJob extends IDocsJobBase {
	/** True bypasses the `contentHash` skip-if-unchanged short-circuit (forced re-index). */
	force?: boolean;
}

/** Payload of `docs.embed`. */
export interface IDocsEmbedJob extends IDocsJobBase {
	/** sha256 of the normalized markdown that was chunked. */
	contentHash: string;
}

/** Payload of `docs.index`. */
export interface IDocsIndexJob extends IDocsJobBase {
	contentHash: string;
	/** `null` = lexical-only indexing (no provider available). */
	embeddingModel: string | null;
	embeddingDims: number | null;
}

/** Payload of the periodic `docs.reconcile` sweep. */
export interface IDocsReconcileJob {
	/** ISO timestamp of the enqueue, for log correlation. */
	requestedAt: string;
}
