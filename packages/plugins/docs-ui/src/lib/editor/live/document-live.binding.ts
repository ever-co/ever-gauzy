import { Extension } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import type { Observable, Subscription } from 'rxjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { LiveAnchorResolver, LiveRelativeRange } from '../comments/comment-anchor.model';
import { LIVE_FIELD, base64, liveAnchorResolverOf, liveRelativeRangeOf } from './document-live.anchors';

/**
 * The editor's half of a live session of a page (`docs-collaboration` T18; server: `DocsLivePlugin`).
 *
 * This file is loaded on demand (the editor imports it dynamically), so Yjs and the collaboration binding land in a
 * chunk of their own and the editor's main chunk stays inside its budget.
 *
 * The rules that keep the shared document whole:
 * - the editor binds TipTap's `Collaboration` extension (field `default`) to an EMPTY document, and the server's
 *   `sync` frame fills it; nothing is ever seeded from the stored JSON here;
 * - after `sync` the editor sends what the server lacks (`Y.encodeStateAsUpdate(doc, stateVector)`), which is how an
 *   edit made while the socket was down reaches the others;
 * - a `sync` of another lineage than the one this document joined means the page was rebuilt on the server: the
 *   binding ends (`lineage`) so the editor starts again with an empty document;
 * - local edits are sent in batches (`batchMs`), merged with `Y.mergeUpdates`.
 */

/** One frame of `Subscription.documentLive` (base64 payloads). */
export interface IDocumentLiveFrame {
	kind: 'sync' | 'update' | 'awareness' | 'mode' | 'closed';
	documentId: string;
	update?: string | null;
	stateVector?: string | null;
	awareness?: string | null;
	readOnly?: boolean | null;
	reason?: string | null;
	revision?: number | null;
	lineage?: string | null;
}

/** A co-editor, as their awareness state says. */
export interface ILiveEditor {
	clientId: number;
	name: string;
	color: string;
}

/** Where the live session stands. */
export interface ILiveState {
	/** `connecting` until the first `sync`; `live` while frames arrive; `ended` once it is over (see `reason`). */
	phase: 'connecting' | 'live' | 'ended';
	readOnly: boolean;
	/** Why the session is read-only, or why it ended (`unavailable`, `lineage`, or the server's reason). */
	reason: string | null;
	/** The other people on the page. */
	editors: ILiveEditor[];
}

/** An HTTP failure of the edit routes, as far as the binding reads it. */
interface IHttpFailure {
	status?: number;
}

export interface ILiveBindingOptions {
	/** Opens the session's frames (`Subscription.documentLive`); called again to resync. */
	frames: () => Observable<IDocumentLiveFrame>;
	postUpdate: (update: string) => Promise<unknown>;
	postAwareness: (awareness: string) => Promise<unknown>;
	user: { name: string; color: string };
	onState: (state: ILiveState) => void;
	/** How long local edits are gathered before they are sent. */
	batchMs?: number;
	setTimeout?: (fn: () => void, ms: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
}

/** What the editor builds on. */
export interface ILiveBinding {
	readonly doc: Y.Doc;
	readonly awareness: Awareness;
	/** `Collaboration` on the document, and the co-editors' cursors. */
	readonly extensions: Extension[];
	/** Reads the live relative positions of comment anchors in the shared document (`docs-collaboration` FR-16). */
	readonly anchorResolver: LiveAnchorResolver;
	/**
	 * The live relative positions of ranges of an editor bound to this document, as its state is now; null while the
	 * editor is not bound to it.
	 */
	relativeRange(state: Parameters<typeof liveRelativeRangeOf>[0]): LiveRelativeRange | null;
	start(): void;
	/** Whether local edits are waiting to be sent (or being sent). */
	hasPending(): boolean;
	/**
	 * Whether the document holds local edits the server has not taken: waiting or being sent, refused (the page turned
	 * read-only, the size limit), or sent to a session the server no longer held and not sent again yet. A session that
	 * ends with such edits must not drop them, and leaving the page must not either.
	 */
	hasUnconfirmed(): boolean;
	/**
	 * Sends the waiting edits now and resolves once the server took them: `false` when some are still waiting at the
	 * deadline (the network, a session that ended), so a leave guard can ask before they are dropped.
	 */
	flush(timeoutMs?: number): Promise<boolean>;
	destroy(): void;
}

/** Origin of what the server sent: not sent back. */
const REMOTE = 'gz-docs-live-remote';

/** An empty Yjs update is two zero bytes. */
const EMPTY_UPDATE_BYTES = 2;

/**
 * Builds the live binding of one editor instance.
 *
 * @param options The transport and the callbacks.
 */
export function createLiveBinding(options: ILiveBindingOptions): ILiveBinding {
	const setTimer = options.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
	const clearTimer =
		options.clearTimeout ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
	const batchMs = options.batchMs ?? 80;
	const doc = new Y.Doc();
	const awareness = new Awareness(doc);
	awareness.setLocalStateField('user', { name: options.user.name, color: options.user.color });

	let subscription: Subscription | null = null;
	let lineage: string | null = null;
	let state: ILiveState = { phase: 'connecting', readOnly: true, reason: null, editors: [] };
	let pending: Uint8Array[] = [];
	let flushTimer: unknown = null;
	let retryTimer: unknown = null;
	let awarenessTimer: unknown = null;
	let sending = false;
	/**
	 * A batch the server has not taken and that waits for no send: refused (403, 413), or dropped with the session it
	 * went to (404) until the session opened again sends what the server lacks.
	 */
	let notTaken = false;
	let destroyed = false;

	const publish = (next: Partial<ILiveState>) => {
		state = { ...state, ...next };
		options.onState(state);
	};

	const editors = (): ILiveEditor[] =>
		Array.from(awareness.getStates().entries())
			.filter(([clientId]) => clientId !== doc.clientID)
			.map(([clientId, value]) => {
				const user = (value as { user?: { name?: unknown; color?: unknown } })?.user;
				return {
					clientId,
					name: typeof user?.name === 'string' ? user.name : '',
					color: typeof user?.color === 'string' ? user.color : '#888888'
				};
			});

	const end = (reason: string) => {
		if (state.phase === 'ended') {
			return;
		}
		stopStream();
		publish({ phase: 'ended', readOnly: true, reason });
	};

	const stopStream = () => {
		subscription?.unsubscribe();
		subscription = null;
	};

	const onFrame = (frame: IDocumentLiveFrame) => {
		switch (frame.kind) {
			case 'sync': {
				if (lineage && frame.lineage && frame.lineage !== lineage) {
					// The page was rebuilt on the server: this document does not merge with it.
					end('lineage');
					return;
				}
				lineage = frame.lineage ?? lineage;
				if (frame.update) {
					Y.applyUpdate(doc, fromBase64(frame.update), REMOTE);
				}
				if (frame.awareness) {
					applyAwarenessUpdate(awareness, fromBase64(frame.awareness), REMOTE);
				}
				publish({
					phase: 'live',
					readOnly: frame.readOnly === true,
					reason: frame.reason ?? null,
					editors: editors()
				});
				// What the server lacks: edits made while the socket was down, or before the frame arrived.
				const missing = frame.stateVector
					? Y.encodeStateAsUpdate(doc, fromBase64(frame.stateVector))
					: Y.encodeStateAsUpdate(doc);
				// It covers every edit still waiting, too, and the ones not taken before when it is sent.
				pending = [];
				if (frame.readOnly !== true) {
					notTaken = false;
				}
				if (missing.length > EMPTY_UPDATE_BYTES && frame.readOnly !== true) {
					pending.push(missing);
					scheduleFlush(0);
				}
				sendAwareness();
				return;
			}
			case 'update':
				if (frame.update) {
					Y.applyUpdate(doc, fromBase64(frame.update), REMOTE);
				}
				return;
			case 'awareness':
				if (frame.awareness) {
					applyAwarenessUpdate(awareness, fromBase64(frame.awareness), REMOTE);
				}
				return;
			case 'mode':
				publish({ readOnly: frame.readOnly === true, reason: frame.reason ?? null });
				return;
			case 'closed':
				end(frame.reason ?? 'closed');
				return;
			default:
				return;
		}
	};

	const open = () => {
		stopStream();
		subscription = options.frames().subscribe({
			next: (frame) => onFrame(frame),
			error: () => end('unavailable'),
			complete: () => end('unavailable')
		});
	};

	const scheduleFlush = (ms: number = batchMs) => {
		if (flushTimer !== null || destroyed) {
			return;
		}
		flushTimer = setTimer(() => {
			flushTimer = null;
			void flush();
		}, ms);
	};

	const flush = async () => {
		if (sending || !pending.length || destroyed || state.phase === 'ended') {
			return;
		}
		const batch = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending);
		pending = [];
		sending = true;
		try {
			await options.postUpdate(base64(batch));
		} catch (error) {
			const status = (error as IHttpFailure)?.status;
			if (status === 404) {
				// The server no longer holds this session: open it again; its `sync` asks for what it lacks. Until a
				// writable one does, the batch is the server's in no way (the stream may end first).
				notTaken = true;
				open();
			} else if (status === 403 || status === 413) {
				notTaken = true;
				publish({ readOnly: true, reason: status === 413 ? 'size_limit' : (state.reason ?? 'read_only') });
			} else if (status === 400) {
				// An edit the page cannot take: the server applied nothing of it. Resync, so the editor shows the page as it is.
				open();
			} else {
				// The network: the same edits go again shortly.
				pending.unshift(batch);
				if (retryTimer === null) {
					retryTimer = setTimer(() => {
						retryTimer = null;
						scheduleFlush(0);
					}, 2000);
				}
			}
		} finally {
			sending = false;
			// A failed batch waits for its retry; only edits made meanwhile go on the normal schedule.
			if (pending.length && retryTimer === null) {
				scheduleFlush();
			}
		}
	};

	/**
	 * Sends what is waiting now, and resolves once nothing is (or the time is up): `false` when edits are left, a
	 * batch not taken included.
	 */
	const flushNow = async (timeoutMs: number): Promise<boolean> => {
		const deadline = Date.now() + timeoutMs;
		while ((pending.length || sending) && Date.now() < deadline && !destroyed && state.phase === 'live') {
			if (flushTimer !== null) {
				clearTimer(flushTimer);
				flushTimer = null;
			}
			if (retryTimer !== null) {
				clearTimer(retryTimer);
				retryTimer = null;
			}
			if (sending) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			} else {
				await flush();
				if (pending.length) {
					// The send failed: try again shortly, until the deadline.
					await new Promise((resolve) => setTimeout(resolve, 250));
				}
			}
		}
		return !pending.length && !sending && !notTaken;
	};

	const sendAwareness = () => {
		if (awarenessTimer !== null || destroyed || state.phase !== 'live') {
			return;
		}
		awarenessTimer = setTimer(() => {
			awarenessTimer = null;
			if (destroyed || state.phase !== 'live') {
				return;
			}
			void options.postAwareness(base64(encodeAwarenessUpdate(awareness, [doc.clientID]))).catch(() => undefined);
		}, 100);
	};

	doc.on('update', (update: Uint8Array, origin: unknown) => {
		if (origin === REMOTE || destroyed) {
			return;
		}
		if (state.readOnly && state.phase === 'live') {
			// The editor is read-only; nothing it does is the page's.
			return;
		}
		pending.push(update);
		if (state.phase === 'live') {
			scheduleFlush();
		}
	});

	awareness.on('update', (_changes: unknown, origin: unknown) => {
		if (origin === 'local') {
			sendAwareness();
		} else {
			publish({ editors: editors() });
		}
	});

	const cursor = Extension.create({
		name: 'gzLiveCursor',
		addProseMirrorPlugins: () => [yCursorPlugin(awareness)]
	});

	return {
		doc,
		awareness,
		extensions: [Collaboration.configure({ document: doc, field: LIVE_FIELD }) as unknown as Extension, cursor],
		anchorResolver: liveAnchorResolverOf(doc, LIVE_FIELD),
		relativeRange: (state) => liveRelativeRangeOf(state, doc),
		start: () => open(),
		hasPending: () => pending.length > 0 || sending,
		hasUnconfirmed: () => pending.length > 0 || sending || notTaken,
		flush: (timeoutMs = 4000) => flushNow(timeoutMs),
		destroy: () => {
			destroyed = true;
			stopStream();
			for (const timer of [flushTimer, retryTimer, awarenessTimer]) {
				if (timer !== null) {
					clearTimer(timer);
				}
			}
			removeAwarenessStates(awareness, [doc.clientID], 'local');
			awareness.destroy();
			doc.destroy();
		}
	};
}

function fromBase64(encoded: string): Uint8Array {
	const binary = atob(encoded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
