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
	/**
	 * Whether the `docs.classify` stage may run for this document.
	 *
	 * Resolved on the **request** thread (`classifyWithAi` of the upload form ?? the org
	 * `autoClassify` default) because `DocumentSettingsService` reads the tenant off
	 * `RequestContext`, which queue threads do not have. `false` skips classification;
	 * `undefined` (every pre-existing payload, and every enqueue that expresses no opinion)
	 * classifies exactly as before.
	 */
	classify?: boolean;
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

/** Payload of `docs.thumbnail`. */
export interface IDocsThumbnailJob extends IDocsJobBase {
	/**
	 * True regenerates a thumbnail that already exists. Set by the runs that changed the
	 * bytes (`replace`) or were explicitly asked to redo the work (`reindex`); every other
	 * run skips a document whose `thumbKey` is already set, so a recovery sweep or a
	 * duplicate enqueue costs nothing.
	 */
	force?: boolean;
}

/** Payload of the periodic `docs.reconcile` sweep. */
export interface IDocsReconcileJob {
	/** ISO timestamp of the enqueue, for log correlation. */
	requestedAt: string;
}
