import { Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource, In } from 'typeorm';
import {
	ID,
	IInboxItemChange,
	IInboxItemFeed,
	IInboxItemObserver,
	IInboxObservedItem,
	IInboxRecipientPage,
	IInboxRecipientStateField,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { InboxItem } from './entities/inbox-item.entity';
import { InboxItemRecipient } from './entities/inbox-item-recipient.entity';
import { toInboxItem } from './inbox-item.mapper';

/** The most rows one page of the feed's reads returns. */
export const INBOX_FEED_MAX_PAGE = 1000;
/** User ids one `IN` list names at most. */
const IN_CHUNK = 500;

type RawRecipientRow = {
	id: ID;
	userId: ID;
	inboxItemId: ID;
	organizationId: ID | null;
	source: string;
	kind: string;
	itemUpdatedAt: Date | string | null;
	recipientUpdatedAt: Date | string | null;
};

/** The later of two times read from the database (a driver answers a `Date` or a string). */
function laterOf(a: Date | string | null, b: Date | string | null): Date | string | null {
	const at = (value: Date | string | null) => (value === null ? Number.NaN : new Date(value).getTime());
	if (Number.isNaN(at(a))) return b;
	if (Number.isNaN(at(b))) return a;
	return at(a) >= at(b) ? a : b;
}

/** The signed-in user of the request, if any (a source's write has none). */
function currentUserId(): ID | null {
	try {
		return (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		return null;
	}
}

/**
 * The Inbox's observer seam (`INBOX_ITEM_FEED`, additive to the writer and the source handlers): plugins that mirror
 * the Inbox elsewhere (the Ever Works integration) register an observer, are told about every write of
 * `InboxService` — an item created or re-delivered, a reply, one recipient's read / archive / snooze, mark-all-read —
 * and read one recipient's copy of an item when they act on it. The Inbox depends on none of them.
 *
 * An observer never fails or delays a write: it is called after the write, its error is logged, and an observer that
 * must not lose a change keeps its own durable queue (with `recipientsChangedSince` for a notice it missed).
 */
@Injectable()
export class InboxItemFeed implements IInboxItemFeed {
	private readonly logger = new Logger('InboxItemFeed');
	private readonly observers = new Map<string, IInboxItemObserver>();

	constructor(private readonly dataSource: DataSource) {}

	register(observer: IInboxItemObserver): void {
		this.observers.set(observer.id, observer);
	}

	unregister(id: string): void {
		this.observers.delete(id);
	}

	/** Whether anything listens (the writes skip building a change otherwise). */
	get observed(): boolean {
		return this.observers.size > 0;
	}

	// ---------------------------------------------------------------- notices (called by InboxService)

	/**
	 * An item was written (created, re-delivered) or answered: every recipient of it is concerned, and so is every
	 * recipient the write took it from (`removed`: a source that replaced its recipients), whose copy elsewhere ends.
	 */
	async itemChanged(
		item: InboxItem,
		type: IInboxItemChange['type'],
		removed: Array<Pick<InboxItemRecipient, 'id' | 'userId'>> = []
	): Promise<void> {
		if (!this.observed) return;
		try {
			const recipients = await this.dataSource.getRepository(InboxItemRecipient).find({
				where: { inboxItemId: item.id as ID, tenantId: item.tenantId as ID },
				select: { id: true, userId: true }
			});
			this.notify({
				...this.identityOf(item),
				scope: 'item',
				type,
				recipients: recipients.map((row) => ({ id: row.id as ID, userId: row.userId as ID })),
				...(removed.length
					? { removedRecipients: removed.map((row) => ({ id: row.id as ID, userId: row.userId as ID })) }
					: {}),
				actorUserId: currentUserId()
			});
		} catch (error) {
			this.logger.warn(`Inbox item ${item.id}: its observers were not told (${(error as Error)?.message ?? error}).`);
		}
	}

	/** One recipient's own state changed (read, archive, snooze). */
	async recipientChanged(
		item: InboxItem,
		recipient: Pick<InboxItemRecipient, 'id' | 'userId'>,
		stated: IInboxRecipientStateField[]
	): Promise<void> {
		if (!this.observed) return;
		this.notify({
			...this.identityOf(item),
			scope: 'recipient',
			type: 'updated',
			recipients: [{ id: recipient.id as ID, userId: recipient.userId as ID }],
			stated,
			actorUserId: currentUserId()
		});
	}

	/** Mark-all-read: one recipient change per item, in the order given (the caller runs it in the background). */
	async recipientsRead(tenantId: ID, userId: ID, rows: Array<{ recipientId: ID; itemId: ID }>): Promise<void> {
		if (!this.observed || !rows.length) return;
		for (let start = 0; start < rows.length; start += IN_CHUNK) {
			const chunk = rows.slice(start, start + IN_CHUNK);
			try {
				const items = await this.dataSource
					.getRepository(InboxItem)
					.find({ where: { tenantId, id: In(chunk.map((row) => row.itemId)) } });
				const byId = new Map(items.map((item) => [item.id as ID, item]));
				for (const row of chunk) {
					const item = byId.get(row.itemId);
					if (item) await this.recipientChanged(item, { id: row.recipientId, userId }, ['isRead']);
				}
			} catch (error) {
				this.logger.warn(`Mark-all-read: its observers were not told (${(error as Error)?.message ?? error}).`);
			}
		}
	}

	/**
	 * Tells every observer (best effort, in registration order). Each is called synchronously, in the writer's own
	 * context (so it can tell who wrote), and never awaited: a slow or pending observer delays neither the write nor
	 * the next observer; a rejection is logged like a throw.
	 */
	private notify(change: IInboxItemChange): void {
		for (const observer of this.observers.values()) {
			const failed = (error: unknown) =>
				this.logger.warn(
					`Inbox item ${change.inboxItemId}: the observer ${observer.id} failed (${(error as Error)?.message ?? error}).`
				);
			try {
				const result = observer.changed(change);
				if (result && typeof (result as Promise<void>).then === 'function') (result as Promise<void>).catch(failed);
			} catch (error) {
				failed(error);
			}
		}
	}

	private identityOf(
		item: InboxItem
	): Pick<IInboxItemChange, 'tenantId' | 'organizationId' | 'inboxItemId' | 'kind' | 'source' | 'externalSource'> {
		return {
			tenantId: item.tenantId as ID,
			organizationId: (item.organizationId as ID) ?? null,
			inboxItemId: item.id as ID,
			kind: item.kind,
			source: item.source,
			externalSource: item.externalSource ?? null
		};
	}

	// ---------------------------------------------------------------- reads (for observers)

	async readRecipient(tenantId: ID, recipientId: ID): Promise<IInboxObservedItem | null> {
		const recipient = await this.dataSource
			.getRepository(InboxItemRecipient)
			.findOne({ where: { id: recipientId, tenantId } });
		if (!recipient || recipient.deletedAt) return null;
		const item = await this.dataSource
			.getRepository(InboxItem)
			.findOne({ where: { id: recipient.inboxItemId as ID, tenantId } });
		if (!item || item.deletedAt) return null;
		return { item: toInboxItem(item), recipient: recipient as never };
	}

	async recipientsChangedSince(
		tenantId: ID,
		since: Date,
		options: { organizationId?: ID; after?: string | null; limit?: number } = {}
	): Promise<IInboxRecipientPage> {
		const limit = Math.min(Math.max(options.limit ?? INBOX_FEED_MAX_PAGE, 1), INBOX_FEED_MAX_PAGE);
		const query = this.recipientRows(tenantId)
			.andWhere(
				new Brackets((where) => {
					where.where('item.updatedAt >= :since', { since });
					where.orWhere('recipient.updatedAt >= :since', { since });
				})
			)
			.orderBy('recipient.id', 'ASC')
			.limit(limit + 1);
		if (options.organizationId) query.andWhere('item.organizationId = :organizationId', options);
		if (options.after) query.andWhere('recipient.id > :after', { after: options.after });
		return this.page(await query.getRawMany<RawRecipientRow>(), limit);
	}

	async openRecipientsOf(
		tenantId: ID,
		organizationId: ID,
		userIds: ID[],
		options: { after?: string | null; limit?: number } = {}
	): Promise<IInboxRecipientPage> {
		const limit = Math.min(Math.max(options.limit ?? INBOX_FEED_MAX_PAGE, 1), INBOX_FEED_MAX_PAGE);
		const users = [...new Set(userIds.filter(Boolean))];
		if (!users.length) return { recipients: [], next: null };
		const rows: RawRecipientRow[] = [];
		// One keyset page over every chunk of users: each chunk reads its first `limit + 1` rows after `after`, and the
		// page is the lowest ids of them all.
		for (let start = 0; start < users.length; start += IN_CHUNK) {
			const query = this.recipientRows(tenantId)
				.andWhere('item.organizationId = :organizationId', { organizationId })
				.andWhere('item.status = :open', { open: InboxItemStatusEnum.OPEN })
				.andWhere('recipient.userId IN (:...users)', { users: users.slice(start, start + IN_CHUNK) })
				.andWhere(
					new Brackets((where) => {
						where.where('recipient.isArchived = :notArchived', { notArchived: false });
						where.orWhere('recipient.isArchived IS NULL');
					})
				)
				.orderBy('recipient.id', 'ASC')
				.limit(limit + 1);
			if (options.after) query.andWhere('recipient.id > :after', { after: options.after });
			rows.push(...(await query.getRawMany<RawRecipientRow>()));
		}
		rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
		return this.page(rows, limit);
	}

	/** The recipient rows of a tenant joined to their (not deleted) items, as raw rows. */
	private recipientRows(tenantId: ID) {
		return this.dataSource
			.getRepository(InboxItemRecipient)
			.createQueryBuilder('recipient')
			.innerJoin(InboxItem, 'item', 'item.id = recipient.inboxItemId AND item.tenantId = recipient.tenantId')
			.select('recipient.id', 'id')
			.addSelect('recipient.userId', 'userId')
			.addSelect('recipient.inboxItemId', 'inboxItemId')
			.addSelect('item.organizationId', 'organizationId')
			.addSelect('item.source', 'source')
			.addSelect('item.kind', 'kind')
			.addSelect('item.updatedAt', 'itemUpdatedAt')
			.addSelect('recipient.updatedAt', 'recipientUpdatedAt')
			.where('recipient.tenantId = :tenantId', { tenantId })
			.andWhere('item.deletedAt IS NULL')
			.andWhere('recipient.deletedAt IS NULL');
	}

	private page(rows: RawRecipientRow[], limit: number): IInboxRecipientPage {
		const page = rows.slice(0, limit);
		return {
			recipients: page.map((row) => ({
				id: row.id,
				userId: row.userId,
				inboxItemId: row.inboxItemId,
				organizationId: row.organizationId ?? null,
				source: row.source,
				kind: row.kind as never,
				changedAt: laterOf(row.itemUpdatedAt, row.recipientUpdatedAt),
				itemUpdatedAt: row.itemUpdatedAt ?? null
			})),
			next: rows.length > limit && page.length ? String(page[page.length - 1].id) : null
		};
	}
}
