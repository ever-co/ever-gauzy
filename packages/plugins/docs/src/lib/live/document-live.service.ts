import { AsyncResource } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleDestroy,
	OnModuleInit,
	UnauthorizedException
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { currentSubscriberScope, currentSubscriberUserId, EventBus, GraphqlPubSub, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_NOT_A_PAGE } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { DocumentEvent } from '../events/document.event';
import { claimNextContentRevision, DocumentService } from '../services/document.service';
import { DocumentLiveBridge, IDocumentLiveHandler } from '../services/document-live.bridge';
import {
	DOCS_LIVE_CONNECTION_INVALID,
	DOCS_LIVE_READ_ONLY,
	DOCS_LIVE_SESSION_NOT_FOUND,
	DOCS_LIVE_TOO_LARGE,
	DOCS_LIVE_UPDATE_INVALID,
	DOCS_LIVE_USER_LIMIT,
	DocumentLiveReasonEnum,
	getDocsLiveConfig,
	IDocsLiveConfig
} from './docs-live.config';
import { LiveFrameStream } from './document-live.stream';
import { IDocumentLiveAck, IDocumentLiveFrame, IDocumentLiveStatus } from './document-live.types';
import {
	blockKey,
	decodeLiveState,
	encodeLiveState,
	ILiveJsonNode,
	ILiveMeta,
	lineageOf,
	liveDocumentJson,
	replaceLiveContent,
	seedLiveDocument
} from './document-live.yjs';

/** Origin of an edit relayed from another API process: shown to this process's sessions, not relayed again. */
const REMOTE = Symbol('docs-live-remote');
/** Origin of a merge of the stored state: shown to this process's sessions, not relayed (every process reads it). */
const STORAGE = Symbol('docs-live-storage');
/** Origin of a server-side write applied to the live document (a restore, a Markdown or API save). */
const SERVER = Symbol('docs-live-server');

/** How many frames may wait for a session that is not reading. */
const MAX_BUFFERED_FRAMES = 1000;
/** How long a persist waits for an outside write to finish applying itself before it applies it itself. */
const OUTSIDE_WRITE_ATTEMPTS = 8;
/** The edits relayed from another process are saved by that process; this one saves them later, as a backstop. */
const REMOTE_PERSIST_DELAY_MS = 15_000;
/** Connection ids are chosen by the client: a tab id, a UUID. */
const CONNECTION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A message between the API processes that hold the same page. */
interface ILiveRelay {
	instance: string;
	kind: 'update' | 'awareness' | 'client-update' | 'client-awareness' | 'access' | 'flush';
	data?: string;
	connectionId?: string;
	userId?: string;
	revision?: number;
}

/** One live session: one connection (a tab, a device) of one user to one page. */
interface ILiveSession {
	readonly connectionId: string;
	readonly userId: string;
	readonly tenantId: string;
	readonly organizationId: string | null;
	/** The subscriber's request context, which access re-checks and the persist of its edits run in. */
	readonly context: AsyncResource;
	readonly stream: LiveFrameStream<IDocumentLiveFrame>;
	/** The awareness client ids this session reported (one per editor instance). */
	readonly awarenessClients: Set<number>;
	canWrite: boolean;
	readOnly: boolean;
	reason: DocumentLiveReasonEnum | null;
	closed: boolean;
}

/** One page held live by this process. */
interface ILiveDocument {
	readonly documentId: string;
	readonly tenantId: string;
	readonly organizationId: string | null;
	readonly doc: Y.Doc;
	readonly awareness: Awareness;
	readonly lineage: string;
	readonly sessions: Map<string, ILiveSession>;
	/** The event name of the page's relay topic (`docs.live.<id>`, on the tenant's topic). */
	readonly topic: string;
	/** The revision the state was last stored under. */
	revision: number;
	relay?: AsyncIterableIterator<ILiveRelay>;
	/** Edits of this process's sessions that are not stored yet. */
	dirty: boolean;
	/** Edits relayed from another process that this one has not seen stored yet. */
	dirtyRemote: boolean;
	firstDirtyAt: number;
	editSequence: number;
	persistTimer?: NodeJS.Timeout;
	recheckTimer?: NodeJS.Timeout;
	recheckSoon?: NodeJS.Timeout;
	/** The session whose edit came last; the persist runs in its request context. */
	lastWriter?: ILiveSession;
	/** Serialises the persist, the server-side writes and the unload. */
	chain: Promise<unknown>;
	/** The size of the state, kept up to date between persists by adding the edits. */
	size: number;
	/** While the persist saves, its own `DocumentEvent` is not an access change. */
	selfSaving: boolean;
	unloaded: boolean;
}

/**
 * The live editing sessions of Docs pages (`docs-collaboration` plan, phase 3: tasks T15–T17).
 *
 * Each page someone edits live is one Yjs document in the API process that serves the session, seeded from the
 * stored JSON or loaded from the stored state. Editors receive it over `Subscription.documentLive` (the platform's
 * GraphQL subscription channel, the same socket as the collaboration events) and send their edits and cursors to
 * `POST /plugins/docs/documents/:id/live/updates` and `…/live/awareness`.
 *
 * **Several API processes.** Each process that holds a session of a page holds its own copy of the page's
 * document. Every edit is relayed to the others over the subscription pub/sub (`docs.live.<id>` on the tenant's
 * topic; Redis when `GRAPHQL_PUBSUB_REDIS` is on), and an edit posted to a process that does not hold the session is
 * handed to the one that does. Yjs merges the copies whatever the order. A persist merges the stored state into the
 * process's copy first, so two processes that persist the same page both keep what the other saved. A seed is built
 * alike in every process (`seedLiveDocument`), so two processes that seed one page hold one lineage.
 *
 * **Persistence.** The edits of a page are saved two seconds after the last one, and at most ten seconds after the
 * first unsaved one, when its last session closes and when the process stops: `contentJson`, `contentHtml` and the
 * state in `contentBinary` (with its lineage and revision), under the content revision claimed in the guarded write
 * every content change takes. The save is the content save's (`DocumentService.saveLiveContent`): the version
 * snapshot, the mention and cross-link sync and the `updated` event, attributed to the editor whose edit came last.
 *
 * **Server-side writes.** An API or Markdown save and a version restore write the stored JSON as before; the bridge
 * then applies the change to the live document, block by block, and stores the state for the new revision, so open
 * editors see it. A duplicate saves the live document first.
 *
 * **Access.** A session is opened only on a page the caller may read; it is read-only without write access, on a
 * locked page and past the page's editor limit. Every session is checked again every minute, when the page changes
 * (a move, a lock, the trash), and when a share changes; a session that lost read access is closed with the reason.
 */
@Injectable()
export class DocumentLiveService implements OnModuleInit, OnModuleDestroy, IDocumentLiveHandler {
	private readonly logger = new Logger(DocumentLiveService.name);

	readonly enabled = true;

	/** This process, so it can tell its own relayed messages from the others'. */
	private readonly instance = randomUUID();

	private readonly live = new Map<string, ILiveDocument>();

	private readonly opening = new Map<string, Promise<ILiveDocument>>();

	private readonly config: IDocsLiveConfig = getDocsLiveConfig();

	private unregister?: () => void;

	private events?: Subscription;

	private closing = false;

	constructor(
		private readonly documents: DocumentService,
		private readonly bridge: DocumentLiveBridge,
		private readonly pubSub: GraphqlPubSub,
		private readonly eventBus: EventBus
	) {}

	onModuleInit(): void {
		this.unregister = this.bridge.register(this);
		this.events = this.eventBus.ofType(DocumentEvent).subscribe((event) => this.onDocumentEvent(event));
	}

	async onModuleDestroy(): Promise<void> {
		this.closing = true;
		this.unregister?.();
		this.events?.unsubscribe();
		for (const live of Array.from(this.live.values())) {
			await this.enqueue(live, () => this.persist(live)).catch(() => undefined);
			for (const session of Array.from(live.sessions.values())) {
				this.close(live, session, DocumentLiveReasonEnum.SHUTDOWN);
			}
			this.unload(live);
		}
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Sessions                                                                                                  */
	/* --------------------------------------------------------------------------------------------------------- */

	/**
	 * Opens a live session of a page for the caller (the subscription field's body: the guards have run, and the
	 * request context is the subscriber's).
	 *
	 * @param documentId The page.
	 * @param connectionId The client's id for this connection (a tab); opening it again replaces the session.
	 * @returns The session's frames, a `sync` frame first.
	 */
	async open(documentId: string, connectionId: string): Promise<AsyncIterableIterator<IDocumentLiveFrame>> {
		this.assertConnectionId(connectionId);
		const scope = currentSubscriberScope();
		const userId = currentSubscriberUserId();
		if (!userId) {
			throw new UnauthorizedException('A live session needs a signed-in user.');
		}
		// 404 for a page the caller may not read, as on every other route.
		const document = await this.documents.findOneScoped(documentId as ID);
		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({
				message: 'Live editing applies to PAGE documents only',
				code: DOCS_NOT_A_PAGE
			});
		}
		if (this.sessionsOf(userId, scope.tenantId) >= this.config.maxSessionsPerUser) {
			throw new HttpException(
				{
					message: `A user holds at most ${this.config.maxSessionsPerUser} live sessions`,
					code: DOCS_LIVE_USER_LIMIT
				},
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
		const canWrite = await this.mayWrite(document);

		let live = await this.acquire(document);
		if (live.unloaded) {
			live = await this.acquire(document);
		}
		const replaced = live.sessions.get(connectionId);
		if (replaced) {
			this.close(live, replaced, DocumentLiveReasonEnum.REPLACED);
		}

		const session: ILiveSession = {
			connectionId,
			userId,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId ?? null,
			context: new AsyncResource('DocsLiveSession'),
			stream: new LiveFrameStream<IDocumentLiveFrame>(MAX_BUFFERED_FRAMES, () => this.leave(live, session)),
			awarenessClients: new Set<number>(),
			canWrite,
			readOnly: true,
			reason: null,
			closed: false
		};
		this.decideMode(live, session, document.isLocked === true, live.sessions.size);
		live.sessions.set(connectionId, session);

		const clients = Array.from(live.awareness.getStates().keys());
		session.stream.push({
			kind: 'sync',
			documentId: live.documentId,
			update: base64(Y.encodeStateAsUpdate(live.doc)),
			stateVector: base64(Y.encodeStateVector(live.doc)),
			awareness: clients.length ? base64(encodeAwarenessUpdate(live.awareness, clients)) : null,
			readOnly: session.readOnly,
			reason: session.reason,
			revision: live.revision,
			lineage: live.lineage
		});
		return session.stream;
	}

	/**
	 * Applies an edit a session sent (a Yjs update).
	 *
	 * @param documentId The page.
	 * @param connectionId The session's connection.
	 * @param update The update, base64.
	 * @returns Whether it was applied here or handed to the process that holds the session.
	 */
	async applyClientUpdate(documentId: string, connectionId: string, update: string): Promise<IDocumentLiveAck> {
		const bytes = this.decodePayload(update, this.config.maxUpdateBytes);
		const { live, session } = this.localSession(documentId, connectionId);
		if (!live || !session) {
			return this.handToHolder(documentId, connectionId, 'client-update', update);
		}
		this.applyFromSession(live, session, bytes);
		return { accepted: true, relayed: false };
	}

	/**
	 * Applies a cursor / presence change a session sent (a y-protocols awareness update).
	 *
	 * @param documentId The page.
	 * @param connectionId The session's connection.
	 * @param awareness The awareness update, base64.
	 */
	async applyClientAwareness(documentId: string, connectionId: string, awareness: string): Promise<IDocumentLiveAck> {
		const bytes = this.decodePayload(awareness, 64 * 1024);
		const { live, session } = this.localSession(documentId, connectionId);
		if (!live || !session) {
			return this.handToHolder(documentId, connectionId, 'client-awareness', awareness);
		}
		this.applyAwarenessFromSession(live, session, bytes);
		return { accepted: true, relayed: false };
	}

	/** The sessions this process serves. */
	status(): IDocumentLiveStatus {
		let sessions = 0;
		for (const live of this.live.values()) {
			sessions += live.sessions.size;
		}
		return { enabled: true, shared: this.reachesOtherProcesses(), documents: this.live.size, sessions };
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Bridge                                                                                                    */
	/* --------------------------------------------------------------------------------------------------------- */

	/** {@inheritDoc IDocumentLiveHandler.contentWritten} */
	async contentWritten(previous: Document, updated: Document): Promise<void> {
		if (!updated?.id || updated.kind !== DocumentKindEnum.PAGE) {
			return;
		}
		const revision = revisionOf(updated);
		const local = this.live.get(String(updated.id));
		if (local && !local.unloaded) {
			await this.enqueue(local, async () => {
				if (local.revision >= revision) {
					return;
				}
				// The revision first: the relayed change carries it, so the other processes learn where the page is.
				local.revision = revision;
				replaceLiveContent(local.doc, updated.contentJson, SERVER);
				await this.storeState(
					local.documentId,
					local.tenantId,
					local.doc,
					{ lineage: local.lineage, revision },
					updated.updatedAt
				);
			});
			return;
		}

		// Not held here: the live state, if the page has one, is the stored one the write kept.
		const stored = decodeLiveState(previous?.contentBinary as Buffer | null);
		if (!stored || stored.meta.revision !== revisionOf(previous)) {
			stored?.doc.destroy();
			return;
		}
		try {
			const before = Y.encodeStateVector(stored.doc);
			replaceLiveContent(stored.doc, updated.contentJson, SERVER);
			const change = Y.encodeStateAsUpdate(stored.doc, before);
			const meta = { lineage: stored.meta.lineage, revision };
			if (
				await this.storeState(String(updated.id), String(updated.tenantId), stored.doc, meta, updated.updatedAt)
			) {
				// The processes that hold the page apply the change; the stored state already has it.
				await this.publish(String(updated.id), String(updated.tenantId), {
					kind: 'update',
					data: base64(change),
					revision
				});
			}
		} finally {
			stored.doc.destroy();
		}
	}

	/** {@inheritDoc IDocumentLiveHandler.flush} */
	async flush(documentId: ID, tenantId: ID): Promise<void> {
		const live = this.live.get(String(documentId));
		if (live && !live.unloaded) {
			await this.enqueue(live, () => this.persist(live));
			return;
		}
		if (tenantId) {
			// Another process may hold it: it saves soon. The copy takes what was stored, at most the persist window old.
			await this.publish(String(documentId), String(tenantId), { kind: 'flush' });
		}
	}

	/** {@inheritDoc IDocumentLiveHandler.accessChanged} */
	accessChanged(documentId: ID): void {
		const live = this.live.get(String(documentId));
		if (live) {
			this.recheckSoon(live);
		}
		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			void this.publish(String(documentId), String(tenantId), { kind: 'access' });
		}
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Loading                                                                                                   */
	/* --------------------------------------------------------------------------------------------------------- */

	private acquire(document: Document): Promise<ILiveDocument> {
		const id = String(document.id);
		const existing = this.live.get(id);
		if (existing && !existing.unloaded) {
			return Promise.resolve(existing);
		}
		const pending = this.opening.get(id);
		if (pending) {
			return pending;
		}
		const loading = this.load(document).finally(() => this.opening.delete(id));
		this.opening.set(id, loading);
		return loading;
	}

	/**
	 * Loads the page's live state, or seeds it from the stored JSON and stores the seed, so every process that opens
	 * the page from now on loads the same lineage.
	 */
	private async load(document: Document): Promise<ILiveDocument> {
		let row: Document | null = document;
		for (let attempt = 0; attempt < 4 && row; attempt += 1) {
			const revision = revisionOf(row);
			const stored = decodeLiveState(row.contentBinary as Buffer | null);
			if (stored && stored.meta.revision === revision) {
				return this.attach(row, stored.doc, stored.meta);
			}
			stored?.doc.destroy();
			const meta = { lineage: lineageOf(String(row.id), revision), revision };
			const seeded = seedLiveDocument(String(row.id), revision, row.contentJson);
			if (await this.storeState(String(row.id), String(row.tenantId), seeded, meta, row.updatedAt)) {
				return this.attach(row, seeded, meta);
			}
			// The page moved on while it was seeded: read it again.
			seeded.destroy();
			row = await this.readRow(String(document.id), String(document.tenantId));
		}
		throw new ConflictException({
			message: 'The page keeps changing; open it again',
			code: DOCS_LIVE_SESSION_NOT_FOUND
		});
	}

	private attach(row: Document, doc: Y.Doc, meta: ILiveMeta): ILiveDocument {
		const awareness = new Awareness(doc);
		// The server is no editor: it has no cursor of its own.
		awareness.setLocalState(null);
		const live: ILiveDocument = {
			documentId: String(row.id),
			tenantId: String(row.tenantId),
			organizationId: row.organizationId ? String(row.organizationId) : null,
			doc,
			awareness,
			lineage: meta.lineage,
			sessions: new Map(),
			topic: liveTopic(String(row.id)),
			revision: meta.revision,
			dirty: false,
			dirtyRemote: false,
			firstDirtyAt: 0,
			editSequence: 0,
			chain: Promise.resolve(),
			size: Y.encodeStateAsUpdate(doc).length,
			selfSaving: false,
			unloaded: false
		};
		doc.on('update', (update: Uint8Array, origin: unknown) => this.onDocumentUpdate(live, update, origin));
		awareness.on('update', (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) =>
			this.onAwarenessUpdate(live, changes, origin)
		);
		this.live.set(live.documentId, live);
		this.followRelay(live);
		live.recheckTimer = setInterval(() => void this.recheck(live), this.config.recheckSeconds * 1000);
		live.recheckTimer.unref?.();
		return live;
	}

	private unload(live: ILiveDocument): void {
		if (live.unloaded) {
			return;
		}
		live.unloaded = true;
		clearTimeout(live.persistTimer);
		clearTimeout(live.recheckSoon);
		clearInterval(live.recheckTimer);
		void live.relay?.return?.();
		live.awareness.destroy();
		live.doc.destroy();
		if (this.live.get(live.documentId) === live) {
			this.live.delete(live.documentId);
		}
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Edits and cursors                                                                                         */
	/* --------------------------------------------------------------------------------------------------------- */

	private applyFromSession(live: ILiveDocument, session: ILiveSession, bytes: Uint8Array): void {
		if (session.readOnly) {
			throw new ForbiddenException({
				message: 'This live session is read-only',
				code: DOCS_LIVE_READ_ONLY,
				reason: session.reason
			});
		}
		const maxBytes = getDocsConfig().maxBinaryBytes;
		if (live.size + bytes.length > maxBytes) {
			this.setMode(live, session, true, DocumentLiveReasonEnum.SIZE_LIMIT);
			throw new HttpException(
				{ message: `The page is at its ${maxBytes} byte limit`, code: DOCS_LIVE_TOO_LARGE },
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		try {
			Y.applyUpdate(live.doc, bytes, session);
		} catch {
			throw new BadRequestException({
				message: 'The edit is not a Yjs update of this page',
				code: DOCS_LIVE_UPDATE_INVALID
			});
		}
		live.lastWriter = session;
	}

	private applyAwarenessFromSession(live: ILiveDocument, session: ILiveSession, bytes: Uint8Array): void {
		try {
			applyAwarenessUpdate(live.awareness, bytes, session);
		} catch {
			throw new BadRequestException({
				message: 'The awareness update cannot be read',
				code: DOCS_LIVE_UPDATE_INVALID
			});
		}
	}

	private onDocumentUpdate(live: ILiveDocument, update: Uint8Array, origin: unknown): void {
		live.size += update.length;
		const frame: IDocumentLiveFrame = { kind: 'update', documentId: live.documentId, update: base64(update) };
		for (const session of Array.from(live.sessions.values())) {
			if (session !== origin) {
				this.deliver(live, session, frame);
			}
		}
		if (origin !== REMOTE && origin !== STORAGE) {
			void this.publish(live.documentId, live.tenantId, {
				kind: 'update',
				data: frame.update ?? undefined,
				revision: live.revision
			});
		}
		if (isSession(origin)) {
			live.editSequence += 1;
			if (!live.dirty) {
				live.dirty = true;
				live.firstDirtyAt = Date.now();
			}
			this.schedulePersist(live);
		} else if (origin === REMOTE) {
			live.dirtyRemote = true;
			this.schedulePersist(live, REMOTE_PERSIST_DELAY_MS);
		}
	}

	private onAwarenessUpdate(
		live: ILiveDocument,
		changes: { added: number[]; updated: number[]; removed: number[] },
		origin: unknown
	): void {
		if (isSession(origin)) {
			for (const client of [...changes.added, ...changes.updated]) {
				origin.awarenessClients.add(client);
			}
			for (const client of changes.removed) {
				origin.awarenessClients.delete(client);
			}
		}
		const clients = [...changes.added, ...changes.updated, ...changes.removed];
		if (!clients.length) {
			return;
		}
		const update = base64(encodeAwarenessUpdate(live.awareness, clients));
		const frame: IDocumentLiveFrame = { kind: 'awareness', documentId: live.documentId, awareness: update };
		for (const session of Array.from(live.sessions.values())) {
			if (session !== origin) {
				this.deliver(live, session, frame);
			}
		}
		// A timeout is every process's own business; a departure and an editor's change are told to the others.
		if (origin !== REMOTE && origin !== 'timeout') {
			void this.publish(live.documentId, live.tenantId, { kind: 'awareness', data: update });
		}
	}

	private deliver(live: ILiveDocument, session: ILiveSession, frame: IDocumentLiveFrame): void {
		if (session.closed) {
			return;
		}
		if (!session.stream.push(frame)) {
			this.close(live, session, DocumentLiveReasonEnum.OVERLOADED);
		}
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Persistence                                                                                               */
	/* --------------------------------------------------------------------------------------------------------- */

	private schedulePersist(live: ILiveDocument, delay: number = this.config.persistDebounceMs): void {
		if (live.unloaded || this.closing) {
			return;
		}
		const waited = live.dirty ? Date.now() - live.firstDirtyAt : 0;
		const due = Math.max(0, Math.min(delay, this.config.persistMaxWaitMs - waited));
		clearTimeout(live.persistTimer);
		live.persistTimer = setTimeout(() => {
			live.persistTimer = undefined;
			void this.enqueue(live, () => this.persist(live)).catch((error) =>
				this.logger.warn(
					`The live document of ${live.documentId} was not saved: ${(error as Error)?.message ?? error}`
				)
			);
		}, due);
		live.persistTimer.unref?.();
	}

	/** Runs one step of a page's chain: persists, server-side writes and the unload never overlap. */
	private enqueue<T>(live: ILiveDocument, step: () => Promise<T>): Promise<T> {
		const run = live.chain.then(step, step);
		live.chain = run.catch(() => undefined);
		return run;
	}

	/** Saves the page's edits, in the request context of the editor whose edit came last. */
	private async persist(live: ILiveDocument): Promise<void> {
		if ((!live.dirty && !live.dirtyRemote) || live.unloaded) {
			return;
		}
		const writer = live.lastWriter ?? Array.from(live.sessions.values())[0];
		if (!writer) {
			// Only edits relayed from another process, and no editor here to save them as: that process saves them.
			live.dirtyRemote = false;
			return;
		}
		await writer.context.runInAsyncScope(() => this.persistNow(live));
	}

	private async persistNow(live: ILiveDocument): Promise<void> {
		const sequence = live.editSequence;
		for (let attempt = 0; attempt < OUTSIDE_WRITE_ATTEMPTS + 2; attempt += 1) {
			const row = await this.readRow(live.documentId, live.tenantId);
			if (!row || row.deletedAt) {
				this.closeAll(live, DocumentLiveReasonEnum.TRASHED);
				return;
			}
			const revision = revisionOf(row);
			const stored = decodeLiveState(row.contentBinary as Buffer | null);
			if (stored && stored.meta.lineage === live.lineage) {
				if (stored.meta.revision !== revision && attempt < OUTSIDE_WRITE_ATTEMPTS) {
					// A write outside the live document is applying itself (its state is stored right after its JSON).
					stored.doc.destroy();
					await sleep(250 * (attempt + 1));
					continue;
				}
				Y.applyUpdate(live.doc, Y.encodeStateAsUpdate(stored.doc), STORAGE);
				stored.doc.destroy();
			} else {
				stored?.doc.destroy();
			}
			if (
				revision > live.revision &&
				(!stored || stored.meta.lineage !== live.lineage || stored.meta.revision !== revision)
			) {
				// The page was written outside the live document, and nothing applied the write to it: apply it now.
				replaceLiveContent(live.doc, row.contentJson, SERVER);
			}
			live.revision = Math.max(live.revision, revision);

			const contentJson = liveDocumentJson(live.doc);
			if (sameContent(contentJson, row.contentJson)) {
				// Nothing for the content columns; the state is stored so a reload replays the edits.
				if (
					await this.storeState(
						live.documentId,
						live.tenantId,
						live.doc,
						{ lineage: live.lineage, revision },
						row.updatedAt
					)
				) {
					this.settled(live, sequence);
					return;
				}
				continue;
			}

			let next: number;
			try {
				next = await claimNextContentRevision(this.documents.typeOrmDocumentRepository, row);
			} catch (error) {
				if (error instanceof ConflictException) {
					continue;
				}
				throw error;
			}
			live.selfSaving = true;
			try {
				await this.documents.saveLiveContent(row, {
					contentJson,
					contentBinary: encodeLiveState(live.doc, { lineage: live.lineage, revision: next }),
					contentRevision: next
				});
			} finally {
				live.selfSaving = false;
			}
			live.revision = next;
			live.size = Y.encodeStateAsUpdate(live.doc).length;
			this.settled(live, sequence);
			return;
		}
		this.logger.warn(`The live document of ${live.documentId} could not be saved; it is tried again.`);
		this.schedulePersist(live, 5000);
	}

	/** Marks the edits up to `sequence` saved; later ones are saved by another persist. */
	private settled(live: ILiveDocument, sequence: number): void {
		live.dirtyRemote = false;
		if (live.editSequence === sequence) {
			live.dirty = false;
			live.firstDirtyAt = 0;
			return;
		}
		live.firstDirtyAt = Date.now();
		this.schedulePersist(live);
	}

	/**
	 * Stores the state for the revision the page is at, without touching its content columns or its concurrency
	 * token (`updatedAt` is written back as it was, so an editor's stale-save check is not disturbed).
	 *
	 * @returns False when the page is at another revision now.
	 */
	private async storeState(
		documentId: string,
		tenantId: string,
		doc: Y.Doc,
		meta: ILiveMeta,
		updatedAt: Date | undefined
	): Promise<boolean> {
		const binary = encodeLiveState(doc, meta);
		const maxBytes = getDocsConfig().maxBinaryBytes;
		if (binary.length > maxBytes) {
			this.logger.warn(`The live state of ${documentId} is over the ${maxBytes} byte limit and is not stored.`);
			return true;
		}
		const result = await this.documents.typeOrmDocumentRepository.update(
			{ id: documentId as ID, tenantId: tenantId as ID, contentRevision: meta.revision },
			{ contentBinary: binary, ...(updatedAt ? { updatedAt } : {}) } as never
		);
		return !!result.affected;
	}

	private readRow(documentId: string, tenantId: string): Promise<Document | null> {
		return this.documents.typeOrmDocumentRepository.findOne({
			where: { id: documentId as ID, tenantId: tenantId as ID },
			withDeleted: true
		});
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Access                                                                                                    */
	/* --------------------------------------------------------------------------------------------------------- */

	private onDocumentEvent(event: DocumentEvent): void {
		const id = event?.entity?.id ? String(event.entity.id) : null;
		const live = id ? this.live.get(id) : undefined;
		if (!live || live.selfSaving) {
			return;
		}
		this.recheckSoon(live);
	}

	private recheckSoon(live: ILiveDocument): void {
		if (live.unloaded || live.recheckSoon) {
			return;
		}
		live.recheckSoon = setTimeout(() => {
			live.recheckSoon = undefined;
			void this.recheck(live);
		}, 100);
		live.recheckSoon.unref?.();
	}

	/** Checks every session of the page again, each in its own request context. */
	private async recheck(live: ILiveDocument): Promise<void> {
		if (live.unloaded) {
			return;
		}
		const row = await this.documents.typeOrmDocumentRepository
			.findOne({
				// What the access rule reads, not the content.
				select: {
					id: true,
					tenantId: true,
					organizationId: true,
					createdByUserId: true,
					visibility: true,
					organizationTeamId: true,
					isLocked: true,
					kind: true,
					deletedAt: true
				},
				where: { id: live.documentId as ID, tenantId: live.tenantId as ID },
				withDeleted: true
			})
			.catch(() => null);
		if (!row || row.deletedAt) {
			this.closeAll(live, DocumentLiveReasonEnum.TRASHED);
			return;
		}
		let position = 0;
		for (const session of Array.from(live.sessions.values())) {
			const index = position;
			position += 1;
			if (session.closed) {
				continue;
			}
			await session.context.runInAsyncScope(async () => {
				const sameOrganization =
					!session.organizationId ||
					!row.organizationId ||
					String(row.organizationId) === session.organizationId;
				const readable = sameOrganization && (await this.documents.canRead(row).catch(() => false));
				if (!readable) {
					this.close(live, session, DocumentLiveReasonEnum.ACCESS_REVOKED);
					return;
				}
				session.canWrite = await this.mayWrite(row);
				this.decideMode(live, session, row.isLocked === true, index);
			});
		}
	}

	private async mayWrite(document: Document): Promise<boolean> {
		try {
			await this.documents.assertCanWrite(document);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Decides whether a session writes, and tells it when that changed.
	 *
	 * @param position How many sessions of the page come before it: the page's editor limit counts in opening order.
	 */
	private decideMode(live: ILiveDocument, session: ILiveSession, locked: boolean, position: number): void {
		const reason = !session.canWrite
			? DocumentLiveReasonEnum.NO_WRITE_ACCESS
			: locked
				? DocumentLiveReasonEnum.LOCKED
				: position >= this.config.maxSessionsPerPage
					? DocumentLiveReasonEnum.SESSION_LIMIT
					: session.reason === DocumentLiveReasonEnum.SIZE_LIMIT
						? DocumentLiveReasonEnum.SIZE_LIMIT
						: null;
		this.setMode(live, session, reason !== null, reason);
	}

	private setMode(
		live: ILiveDocument,
		session: ILiveSession,
		readOnly: boolean,
		reason: DocumentLiveReasonEnum | null
	): void {
		const changed = session.readOnly !== readOnly || session.reason !== reason;
		const opening = !live.sessions.has(session.connectionId);
		session.readOnly = readOnly;
		session.reason = reason;
		if (changed && !opening) {
			this.deliver(live, session, { kind: 'mode', documentId: live.documentId, readOnly, reason });
		}
	}

	private close(live: ILiveDocument, session: ILiveSession, reason: DocumentLiveReasonEnum): void {
		if (session.closed) {
			return;
		}
		session.stream.end({ kind: 'closed', documentId: live.documentId, reason });
		this.leave(live, session);
	}

	private closeAll(live: ILiveDocument, reason: DocumentLiveReasonEnum): void {
		for (const session of Array.from(live.sessions.values())) {
			this.close(live, session, reason);
		}
	}

	/** Removes a session (it closed, or its client went away); the page is saved and let go after its last one. */
	private leave(live: ILiveDocument, session: ILiveSession): void {
		if (session.closed) {
			return;
		}
		session.closed = true;
		if (live.sessions.get(session.connectionId) === session) {
			live.sessions.delete(session.connectionId);
		}
		if (session.awarenessClients.size && !live.unloaded) {
			removeAwarenessStates(live.awareness, Array.from(session.awarenessClients), 'leave');
		}
		if (live.sessions.size === 0 && !live.unloaded && !this.closing) {
			void this.enqueue(live, async () => {
				await this.persist(live);
				if (live.sessions.size === 0) {
					this.unload(live);
				}
			}).catch((error) => {
				this.logger.warn(
					`The live document of ${live.documentId} was not saved on close: ${(error as Error)?.message ?? error}`
				);
				if (live.sessions.size === 0) {
					this.unload(live);
				}
			});
		}
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Between processes                                                                                         */
	/* --------------------------------------------------------------------------------------------------------- */

	private followRelay(live: ILiveDocument): void {
		const relay = this.pubSub.asyncIterableIterator<ILiveRelay>(this.pubSub.topicFor(live.topic, live.tenantId));
		live.relay = relay;
		void (async () => {
			try {
				for await (const message of relay) {
					if (live.unloaded) {
						break;
					}
					try {
						this.onRelay(live, message);
					} catch (error) {
						this.logger.debug(
							`A relayed live message of ${live.documentId} was dropped: ${(error as Error)?.message ?? error}`
						);
					}
				}
			} catch (error) {
				this.logger.debug(`The live relay of ${live.documentId} ended: ${(error as Error)?.message ?? error}`);
			}
		})();
	}

	private onRelay(live: ILiveDocument, message: ILiveRelay): void {
		if (!message || message.instance === this.instance) {
			return;
		}
		switch (message.kind) {
			case 'update':
				if (message.data) {
					Y.applyUpdate(live.doc, fromBase64(message.data), REMOTE);
				}
				if (Number.isInteger(message.revision) && (message.revision as number) > live.revision) {
					live.revision = message.revision as number;
				}
				return;
			case 'awareness':
				if (message.data) {
					applyAwarenessUpdate(live.awareness, fromBase64(message.data), REMOTE);
				}
				return;
			case 'client-update':
			case 'client-awareness': {
				const session = message.connectionId ? live.sessions.get(message.connectionId) : undefined;
				if (!session || session.userId !== message.userId || !message.data) {
					return;
				}
				const bytes = fromBase64(message.data);
				if (message.kind === 'client-update') {
					this.applyFromSession(live, session, bytes);
				} else {
					this.applyAwarenessFromSession(live, session, bytes);
				}
				return;
			}
			case 'access':
				this.recheckSoon(live);
				return;
			case 'flush':
				if (live.dirty || live.dirtyRemote) {
					this.schedulePersist(live, 0);
				}
				return;
		}
	}

	private async publish(documentId: string, tenantId: string, message: Omit<ILiveRelay, 'instance'>): Promise<void> {
		try {
			await this.pubSub.publish(liveTopic(documentId), tenantId, { ...message, instance: this.instance });
		} catch (error) {
			this.logger.debug(`A live message of ${documentId} was not relayed: ${(error as Error)?.message ?? error}`);
		}
	}

	/** An edit for a session this process does not hold goes to the process that holds it. */
	private async handToHolder(
		documentId: string,
		connectionId: string,
		kind: 'client-update' | 'client-awareness',
		data: string
	): Promise<IDocumentLiveAck> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!this.reachesOtherProcesses() || !tenantId || !userId) {
			throw new NotFoundException({
				message: 'No live session of this page is open for this connection',
				code: DOCS_LIVE_SESSION_NOT_FOUND
			});
		}
		await this.publish(documentId, String(tenantId), { kind, connectionId, userId: String(userId), data });
		return { accepted: true, relayed: true };
	}

	private reachesOtherProcesses(): boolean {
		return this.pubSub.sharedAcrossProcesses === true;
	}

	/* --------------------------------------------------------------------------------------------------------- */
	/* Helpers                                                                                                   */
	/* --------------------------------------------------------------------------------------------------------- */

	private localSession(documentId: string, connectionId: string): { live?: ILiveDocument; session?: ILiveSession } {
		this.assertConnectionId(connectionId);
		const live = this.live.get(String(documentId));
		const session = live && !live.unloaded ? live.sessions.get(connectionId) : undefined;
		if (!live || !session) {
			return {};
		}
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		if (!userId || String(userId) !== session.userId || String(tenantId) !== session.tenantId) {
			throw new NotFoundException({
				message: 'No live session of this page is open for this connection',
				code: DOCS_LIVE_SESSION_NOT_FOUND
			});
		}
		return { live, session };
	}

	private sessionsOf(userId: string, tenantId: string): number {
		let count = 0;
		for (const live of this.live.values()) {
			for (const session of live.sessions.values()) {
				if (session.userId === userId && session.tenantId === tenantId) {
					count += 1;
				}
			}
		}
		return count;
	}

	private assertConnectionId(connectionId: string): void {
		if (typeof connectionId !== 'string' || !CONNECTION_ID.test(connectionId)) {
			throw new BadRequestException({
				message: 'The connection id is 8 to 64 letters, digits, - or _',
				code: DOCS_LIVE_CONNECTION_INVALID
			});
		}
	}

	private decodePayload(encoded: string, maxBytes: number): Uint8Array {
		if (typeof encoded !== 'string' || !encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
			throw new BadRequestException({ message: 'The payload is not base64', code: DOCS_LIVE_UPDATE_INVALID });
		}
		const bytes = fromBase64(encoded);
		if (!bytes.length) {
			throw new BadRequestException({ message: 'The payload is empty', code: DOCS_LIVE_UPDATE_INVALID });
		}
		if (bytes.length > maxBytes) {
			throw new HttpException(
				{ message: `One edit is at most ${maxBytes} bytes`, code: DOCS_LIVE_TOO_LARGE },
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		return bytes;
	}
}

/** The event name of a page's relay topic. */
export function liveTopic(documentId: string): string {
	return `docs.live.${documentId}`;
}

function isSession(value: unknown): value is ILiveSession {
	return !!value && typeof value === 'object' && 'connectionId' in (value as object) && 'stream' in (value as object);
}

function revisionOf(document: Pick<Document, 'contentRevision'> | null | undefined): number {
	const revision = Number(document?.contentRevision);
	return Number.isFinite(revision) && revision >= 1 ? revision : 1;
}

function sameContent(live: ILiveJsonNode, stored: unknown): boolean {
	const blocks = (node: unknown): string[] =>
		Array.isArray((node as ILiveJsonNode | null)?.content)
			? ((node as ILiveJsonNode).content as ILiveJsonNode[]).map((block) => blockKey(block))
			: [];
	const a = blocks(live);
	const b = blocks(stored);
	return a.length === b.length && a.every((key, index) => key === b[index]);
}

function base64(bytes: Uint8Array): string {
	return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

function fromBase64(encoded: string): Uint8Array {
	return new Uint8Array(Buffer.from(encoded, 'base64'));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		timer.unref?.();
	});
}
