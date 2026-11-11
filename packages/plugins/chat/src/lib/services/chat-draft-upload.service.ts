import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager, EntitySubscriberInterface, In, InsertEvent, LessThan, ObjectLiteral } from 'typeorm';
import { FileStorageProviderEnum, ID, IChatDraftDiscardResult } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';
import {
	CHAT_DRAFT_SWEEP_BATCH,
	CHAT_DRAFT_SWEEP_INTERVAL_MS,
	draftUploadTtlHours,
	IChatDraftDocument,
	isChatComposerUpload,
	isDraftSweepEnabled,
	isSafeStoredKey,
	isUntouchedDraft,
	storedKeysOf
} from '../chat-draft-uploads';
import { chatSqlDialectOf, jsonListHasColumn } from '../chat-files';
import { ChatAttachmentDraft } from '../entities/chat-attachment-draft.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { IChatCaller } from './chat-access.service';

/** What became of one draft the sweep or a discard took. */
export type ChatDraftOutcome = 'purged' | 'kept' | 'gone';

/** The document columns the draft rules read. */
const DRAFT_DOCUMENT_COLUMNS = {
	id: true,
	tenantId: true,
	organizationId: true,
	kind: true,
	source: true,
	visibility: true,
	parentId: true,
	createdByUserId: true,
	storageProvider: true,
	storageKey: true,
	thumbKey: true
} as const;

/**
 * Draft uploads: the files a chat composer uploaded that no message carries yet (the Chat spec, FR-19).
 *
 * **Recorded** when the Docs upload route stores a chat composer's file (`Document { kind: FILE, source: CHAT }`
 * with the route's `metadata.upload`): an insert listener on the platform's `DataSource` writes the draft row, so
 * every client is covered, older ones included, and the upload itself is untouched. The row is written apart from
 * the document's own transaction (a failure here never fails an upload; a row whose document was never committed is
 * dropped by the sweep).
 *
 * **Consumed** by the send or the edit that attaches the file, in its own transaction ({@link consume}).
 *
 * **Discarded** by its uploader (`DELETE /chat/attachments/:documentId`), or **swept** when it is older than the
 * draft TTL (24 h by default, `GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS`): the document is purged and its stored bytes are
 * freed. The chat plugin is hosted by the API processes, not by `apps/worker`, so the sweep runs there on a timer
 * (`GAUZY_CHAT_DRAFT_SWEEP_ENABLED=false` turns it off); a draft is claimed by deleting its row first, so of several
 * replicas exactly one sweeps it.
 *
 * **The Docs rules hold.** Only a draft that is still the upload its uploader left is purged ({@link isUntouchedDraft}:
 * private, outside the documents tree, theirs) and only while nothing carries it — no document link of any record, no
 * message naming it; anything else keeps the document, as any upload was kept before. Sent files keep the Docs
 * plugin's soft delete. The purge is the row's hard delete (the document's own tables follow by their `ON DELETE
 * CASCADE` keys), and a stored key is freed only when no other document row — trashed ones included — still names it,
 * the rule the Docs plugin's own blob cleanup keeps.
 */
@Injectable()
export class ChatDraftUploadService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('ChatDraftUploadService');
	private timer: NodeJS.Timeout | null = null;
	private sweeping = false;
	private readonly listener: EntitySubscriberInterface<ObjectLiteral> = {
		afterInsert: (event: InsertEvent<ObjectLiteral>) => {
			if (event.metadata?.tableName !== 'document') return;
			const document = event.entity as IChatDraftDocument | undefined;
			if (!isChatComposerUpload(document)) return;
			void this.record(document as IChatDraftDocument);
		}
	};

	constructor(private readonly dataSource: DataSource) {}

	onModuleInit(): void {
		// The listener sees every insert of the data source; it answers at once for any table but `document`.
		this.dataSource.subscribers.push(this.listener);
		if (!isDraftSweepEnabled()) return;
		this.timer = setInterval(() => void this.sweep(), CHAT_DRAFT_SWEEP_INTERVAL_MS);
		this.timer.unref?.();
	}

	onModuleDestroy(): void {
		const index = this.dataSource.subscribers.indexOf(this.listener);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** Records a chat composer's upload as a draft of its uploader (once; never throws). */
	async record(document: IChatDraftDocument): Promise<void> {
		try {
			await this.dataSource
				.createQueryBuilder()
				.insert()
				.into(ChatAttachmentDraft)
				.values({
					documentId: document.id as ID,
					userId: document.createdByUserId as ID,
					tenantId: document.tenantId as ID,
					organizationId: (document.organizationId ?? undefined) as ID
				})
				.orIgnore()
				.execute();
		} catch (error) {
			this.logger.warn(`An uploaded chat file was not recorded as a draft: ${(error as Error)?.message}`);
		}
	}

	/** In a send's or an edit's transaction: the drafts of the files the message now carries are drafts no more. */
	async consume(manager: EntityManager, tenantId: ID, documentIds: readonly ID[]): Promise<void> {
		if (!documentIds.length) return;
		await manager.getRepository(ChatAttachmentDraft).delete({ tenantId, documentId: In([...documentIds]) });
	}

	/**
	 * Discards one of the caller's draft uploads: its document and stored bytes go. A file the caller did not upload
	 * for a message, or one a message carries, reads as not found and stays.
	 */
	async discard(caller: IChatCaller, documentId: ID): Promise<IChatDraftDiscardResult> {
		const draft = await this.dataSource.getRepository(ChatAttachmentDraft).findOne({ where: { tenantId: caller.tenantId, documentId, userId: caller.userId } });
		if (!draft) throw new NotFoundException('The requested record was not found');
		const outcome = await this.take(draft);
		return { discarded: outcome === 'purged' };
	}

	/**
	 * One pass of the sweep: the drafts older than the TTL, oldest first, a batch at a time. Never throws; a draft
	 * that failed is logged (its row is gone, so its document stays as an ordinary upload).
	 *
	 * @returns What became of each draft taken.
	 */
	async sweep(now: Date = new Date()): Promise<Record<ChatDraftOutcome, number>> {
		const counts: Record<ChatDraftOutcome, number> = { purged: 0, kept: 0, gone: 0 };
		if (this.sweeping) return counts;
		this.sweeping = true;
		try {
			const cutoff = new Date(now.getTime() - draftUploadTtlHours() * 60 * 60 * 1000);
			const expired = await this.dataSource.getRepository(ChatAttachmentDraft).find({
				where: { createdAt: LessThan(cutoff) },
				order: { createdAt: 'ASC' },
				take: CHAT_DRAFT_SWEEP_BATCH
			});
			for (const draft of expired) {
				try {
					counts[await this.take(draft)] += 1;
				} catch (error) {
					this.logger.warn(`A draft upload was not swept: ${(error as Error)?.message}`);
				}
			}
			if (counts.purged) this.logger.log(`Swept ${counts.purged} unsent chat upload(s).`);
		} catch (error) {
			this.logger.warn(`The sweep of unsent chat uploads failed: ${(error as Error)?.message}`);
		} finally {
			this.sweeping = false;
		}
		return counts;
	}

	/**
	 * Takes one draft: claims it (its row deleted by this process, or by nobody), then purges its document when it is
	 * still an untouched upload nothing carries.
	 */
	private async take(draft: ChatAttachmentDraft): Promise<ChatDraftOutcome> {
		const claimed = await this.dataSource.getRepository(ChatAttachmentDraft).delete({ id: draft.id as ID, tenantId: draft.tenantId as ID });
		// Another process (a replica's sweep, a second discard) took it first.
		if (!(claimed.affected ?? 0)) return 'gone';
		return this.purge(draft.tenantId as ID, draft.documentId, draft.userId);
	}

	/** Purges a draft's document and frees its stored bytes, when the rules allow it (see the class). */
	private async purge(tenantId: ID, documentId: ID, uploaderUserId: ID): Promise<ChatDraftOutcome> {
		const documents = this.dataSource.getRepository<ObjectLiteral>('Document');
		const document = (await documents.findOne({ select: DRAFT_DOCUMENT_COLUMNS, where: { id: documentId, tenantId }, withDeleted: true } as never)) as IChatDraftDocument | null;
		if (!document) return 'gone';
		if (!isUntouchedDraft(document, uploaderUserId) || (await this.isCarried(tenantId, documentId))) return 'kept';
		await documents.delete({ id: documentId, tenantId } as never);
		for (const key of storedKeysOf(document)) {
			await this.freeStoredKey(key, document.storageProvider ?? null);
		}
		return 'purged';
	}

	/** Whether anything carries the document: a link of any record, or a message naming it among its attachments. */
	private async isCarried(tenantId: ID, documentId: ID): Promise<boolean> {
		const links = await this.dataSource.getRepository<ObjectLiteral>('DocumentLink').count({ where: { documentId, tenantId }, withDeleted: true } as never);
		if (links > 0) return true;
		const dialect = chatSqlDialectOf(String(this.dataSource.options?.type));
		const named = await this.dataSource
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
			.withDeleted()
			.where('message.tenantId = :tenantId', { tenantId })
			.andWhere(jsonListHasColumn('message.attachmentIds', ':documentId', dialect), { documentId })
			.getCount();
		return named > 0;
	}

	/** Frees a stored key once no document row (trashed ones included) names it any more. Never throws. */
	private async freeStoredKey(key: string, storageProvider: string | null): Promise<void> {
		if (!isSafeStoredKey(key)) return;
		try {
			const documents = this.dataSource.getRepository<ObjectLiteral>('Document');
			const stillNamed = await documents.count({ where: [{ storageKey: key }, { thumbKey: key }], withDeleted: true } as never);
			if (stillNamed > 0) return;
			const provider = new FileStorage().getProvider((storageProvider ?? undefined) as FileStorageProviderEnum | undefined);
			await provider.deleteFile(key);
		} catch (error) {
			this.logger.warn(`The stored bytes of an unsent chat upload were not freed: ${(error as Error)?.message}`);
		}
	}
}
