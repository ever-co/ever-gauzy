import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager, EntitySubscriberInterface, In, InsertEvent, LessThan, ObjectLiteral } from 'typeorm';
import { FileStorageProviderEnum, ID, IChatDraftDiscardResult } from '@gauzy/contracts';
import { FileStorage, runWithTenantStorageSettings, TenantSettingService } from '@gauzy/core';
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
import { chatLocksRows, inWriteTransaction } from '../realtime/chat-write-transaction';
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
	thumbKey: true,
	isArchived: true,
	deletedAt: true
} as const;

/**
 * Draft uploads: the files a chat composer uploaded that no message carries yet (the Chat spec, FR-19).
 *
 * **Recorded** when the Docs upload route stores a chat composer's file (`Document { kind: FILE, source: CHAT }`
 * with the route's `metadata.upload`): an insert listener on the platform's TypeORM `DataSource` writes the draft row
 * in the document's own transaction (the insert awaits the listener before it commits), so a draft and its document
 * commit together or not at all, and every client is covered, older ones included. A platform running MikroORM
 * records no draft: its chat uploads stay ordinary uploads, as before.
 *
 * **Consumed** by the send or the edit that attaches the file, in its own transaction ({@link consume}), which holds
 * the files' rows until it commits.
 *
 * **Discarded** by its uploader (`DELETE /chat/attachments/:documentId`), or **swept** when it is older than the
 * draft TTL (24 h by default, `GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS`): the document is purged and its stored bytes are
 * freed. The chat plugin is hosted by the API processes, not by `apps/worker`, so the sweep runs there on a timer
 * (`GAUZY_CHAT_DRAFT_SWEEP_ENABLED=false` turns it off); a draft is claimed by deleting its row first, so of several
 * replicas exactly one sweeps it.
 *
 * **One transaction per draft.** A purge locks the document's row (`FOR UPDATE` on Postgres and MySQL), claims the
 * draft (deletes its row), checks and deletes the document, then commits. A send attaching the file holds that row
 * (`FOR SHARE`) from before its links are written to its commit, so either the send commits first (the checks then
 * see its link and message, and the file stays) or the send waits and is refused (the file is gone; it is attached
 * again): a message never names a removed file. A purge that fails rolls back, its claim included, so the next sweep
 * tries the draft again. The stored bytes are freed after the commit (best effort: a failure there leaves bytes behind,
 * never a row naming missing bytes).
 *
 * **The Docs rules hold.** Only a draft that is still the upload its uploader left is purged ({@link isUntouchedDraft}:
 * private, outside the documents tree, not archived, not in the trash, theirs) and only while nothing of the draft's
 * own tenant carries it — no document link of any record, no share, no message naming it; anything else keeps the
 * document, as any upload was kept before. Sent files keep the Docs plugin's soft delete. The purge is the row's hard delete (the document's own
 * tables follow by their `ON DELETE CASCADE` keys), and a stored key is freed only when no other document row — of any
 * tenant, trashed ones included — still names it, the rule the Docs plugin's own blob cleanup keeps.
 */
@Injectable()
export class ChatDraftUploadService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('ChatDraftUploadService');
	private timer: NodeJS.Timeout | null = null;
	private sweeping = false;
	private readonly listener: EntitySubscriberInterface<ObjectLiteral> = {
		afterInsert: (event: InsertEvent<ObjectLiteral>): Promise<void> | void => {
			if (event.metadata?.tableName !== 'document') return;
			const document = event.entity as IChatDraftDocument | undefined;
			if (!isChatComposerUpload(document)) return;
			// Returned, so the insert awaits it: the draft row is written in the upload's own transaction.
			return this.record(document as IChatDraftDocument, event.manager);
		}
	};

	constructor(
		private readonly dataSource: DataSource,
		private readonly tenantSettings: TenantSettingService
	) {}

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

	/**
	 * Records a chat composer's upload as a draft of its uploader (once). Written through the insert's own manager, so
	 * the draft commits with its document; a failure fails the upload, which the composer lets its user try again.
	 *
	 * @param manager The insert's transaction (the platform's data source when called without one).
	 */
	async record(document: IChatDraftDocument, manager: EntityManager = this.dataSource.manager): Promise<void> {
		await manager
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
	}

	/**
	 * In a send's or an edit's transaction, before its links are written: the files the message carries are held
	 * (`FOR SHARE` on Postgres and MySQL, so a purge of one waits for this commit, then finds it carried) and must still
	 * be there; their drafts are drafts no more. A file a discard or the sweep removed first refuses the message, which
	 * would otherwise name a file that is gone.
	 */
	async consume(manager: EntityManager, tenantId: ID, documentIds: readonly ID[]): Promise<void> {
		if (!documentIds.length) return;
		// One order for every transaction that takes these rows, so two sends never wait on each other in a cycle.
		const ids = [...new Set(documentIds.map(String))].sort() as ID[];
		const present = await manager.getRepository<ObjectLiteral>('Document').find({
			select: { id: true },
			where: { id: In(ids), tenantId },
			order: { id: 'ASC' },
			...(chatLocksRows(this.dataSource) ? { lock: { mode: 'pessimistic_read' } } : {})
		} as never);
		if (present.length !== ids.length) throw new BadRequestException('A file was removed before the message was sent: attach it again.');
		await manager.getRepository(ChatAttachmentDraft).delete({ tenantId, documentId: In(ids) });
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
	 * that failed is logged and stays a draft (its transaction rolled back), so the next pass tries it again.
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
	 * Takes one draft in one transaction (see the class): locks its document's row, claims the draft (its row deleted
	 * by this transaction, or by nobody), and purges the document when it is still an untouched upload nothing carries.
	 * The stored bytes of a purged document are freed after the commit.
	 */
	private async take(draft: ChatAttachmentDraft): Promise<ChatDraftOutcome> {
		const tenantId = draft.tenantId as ID;
		const taken = await inWriteTransaction(this.dataSource, async (manager): Promise<{ outcome: ChatDraftOutcome; document?: IChatDraftDocument }> => {
			const documents = manager.getRepository<ObjectLiteral>('Document');
			// The document first, then the draft: the order a send takes them in ({@link consume}).
			const document = (await documents.findOne({
				select: DRAFT_DOCUMENT_COLUMNS,
				where: { id: draft.documentId, tenantId },
				withDeleted: true,
				...(chatLocksRows(this.dataSource) ? { lock: { mode: 'pessimistic_write' } } : {})
			} as never)) as IChatDraftDocument | null;
			const claimed = await manager.getRepository(ChatAttachmentDraft).delete({ id: draft.id as ID, tenantId });
			// Another process (a replica's sweep, a second discard, the send that attached it) took it first.
			if (!(claimed.affected ?? 0)) return { outcome: 'gone' };
			// Its document was never committed, or was removed since.
			if (!document) return { outcome: 'gone' };
			if (!isUntouchedDraft(document, draft.userId) || (await this.isCarried(manager, tenantId, draft.documentId))) return { outcome: 'kept' };
			await documents.delete({ id: draft.documentId, tenantId } as never);
			return { outcome: 'purged', document };
		});
		if (taken.outcome === 'purged' && taken.document) {
			// The sweep runs on a timer, outside any request, so the tenant's own storage (its bucket and credentials,
			// which the providers read from a request) is read from its settings here.
			const settings = await this.storageSettingsOf(tenantId);
			for (const key of storedKeysOf(taken.document)) {
				await this.freeStoredKey(key, taken.document.storageProvider ?? null, settings);
			}
		}
		return taken.outcome;
	}

	/**
	 * Whether anything of the tenant carries the document: a link of any record, a share, or a message naming it among
	 * its attachments. Trashed links, revoked shares and deleted messages count too: the file was given a life of its own.
	 */
	private async isCarried(manager: EntityManager, tenantId: ID, documentId: ID): Promise<boolean> {
		const links = await manager.getRepository<ObjectLiteral>('DocumentLink').count({ where: { documentId, tenantId }, withDeleted: true } as never);
		if (links > 0) return true;
		const shares = await manager.getRepository<ObjectLiteral>('DocumentShare').count({ where: { documentId, tenantId }, withDeleted: true } as never);
		if (shares > 0) return true;
		const dialect = chatSqlDialectOf(String(this.dataSource.options?.type));
		const named = await manager
			.getRepository(ChatMessage)
			.createQueryBuilder('message')
			.withDeleted()
			.where('message.tenantId = :tenantId', { tenantId })
			.andWhere(jsonListHasColumn('message.attachmentIds', ':documentId', dialect), { documentId })
			.getCount();
		return named > 0;
	}

	/**
	 * The tenant's own settings, as the settings middleware attaches them to a request; `null` when they cannot be read,
	 * so nothing is deleted from the deployment's storage instead of the tenant's.
	 */
	private async storageSettingsOf(tenantId: ID): Promise<Record<string, unknown> | null> {
		try {
			return ((await this.tenantSettings.getSettings({ where: { tenantId } })) ?? {}) as Record<string, unknown>;
		} catch (error) {
			this.logger.warn(`The stored bytes of an unsent chat upload were not freed: the storage settings of its tenant could not be read: ${(error as Error)?.message}`);
			return null;
		}
	}

	/**
	 * Frees a stored key once no document row (trashed ones included) names it any more, in the tenant's own storage
	 * (`settings`; nothing is freed without them). Never throws.
	 */
	private async freeStoredKey(key: string, storageProvider: string | null, settings: Record<string, unknown> | null): Promise<void> {
		if (!isSafeStoredKey(key) || !settings) return;
		try {
			const documents = this.dataSource.getRepository<ObjectLiteral>('Document');
			const stillNamed = await documents.count({ where: [{ storageKey: key }, { thumbKey: key }], withDeleted: true } as never);
			if (stillNamed > 0) return;
			// The provider is made inside the settings: it reads them when it is made.
			await runWithTenantStorageSettings(settings, async () => {
				const provider = new FileStorage().getProvider((storageProvider ?? undefined) as FileStorageProviderEnum | undefined);
				await provider.deleteFile(key);
			});
		} catch (error) {
			this.logger.warn(`The stored bytes of an unsent chat upload were not freed: ${(error as Error)?.message}`);
		}
	}
}
