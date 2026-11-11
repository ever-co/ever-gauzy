import type { DocumentLiveReasonEnum } from './docs-live.config';

/** What one frame of a live session says. */
export type DocumentLiveFrameKind = 'sync' | 'update' | 'awareness' | 'mode' | 'closed';

/**
 * One frame of `Subscription.documentLive`. Binary payloads are base64.
 *
 * - `sync` is the first frame: the page's whole state (`update`), its state vector (`stateVector`, so the client
 *   sends back only what the server lacks), the co-editors' cursors and presence (`awareness`), whether the session
 *   may write (`readOnly`, `reason`), and the lineage and revision of the state. A client holding a document of
 *   another lineage drops it before applying the state: the two would not merge.
 * - `update` is an edit of someone else (or of the server: a restore, a Markdown update).
 * - `awareness` is a change of someone's cursor or presence.
 * - `mode` says the session became read-only or writable again (`readOnly`, `reason`).
 * - `closed` is the last frame (`reason`): the client stops editing live, and opens a new session when it may.
 */
export interface IDocumentLiveFrame {
	kind: DocumentLiveFrameKind;
	documentId: string;
	update?: string | null;
	stateVector?: string | null;
	awareness?: string | null;
	readOnly?: boolean | null;
	reason?: DocumentLiveReasonEnum | string | null;
	revision?: number | null;
	lineage?: string | null;
}

/** The answer to an edit or an awareness update sent to the page. */
export interface IDocumentLiveAck {
	/** The edit was applied (or handed to the process that holds the session). */
	accepted: boolean;
	/** The session is held by another API process; the edit was handed to it over the shared pub/sub. */
	relayed: boolean;
}

/** The live sessions this process serves. */
export interface IDocumentLiveStatus {
	enabled: boolean;
	/** Whether a session held by another API process can be reached (a shared pub/sub, or one process). */
	shared: boolean;
	documents: number;
	sessions: number;
}
