import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotification,
	IInboxItem,
	IInboxItemRecipient,
	IInboxItemUpsertInput,
	IInboxRecipientStateField,
	IInboxRecipientStateInput,
	IInboxSourceHandler,
	IInboxSourceReplyResult,
	INBOX_NOTIFICATION_EXTERNAL_SOURCE,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import {
	Employee,
	EmployeeNotification,
	EmployeeNotificationCreatedEvent,
	EmployeeNotificationUpdatedEvent,
	IEmployeeNotificationStateChange
} from '@gauzy/core';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { INBOX_MENTION_DEDUPE_WINDOW_MS } from '../inbox.constants';
import { InboxNamedLocks } from '../email/database/named-locks';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxService } from '../inbox.service';
import { InboxItemFeed } from '../inbox-item-feed';
import { InboxRealtime } from '../realtime/inbox-realtime';

/**
 * The inbox item a platform notification becomes: kind NOTIFICATION, source GAUZY, identified by the notification
 * (`externalSource` / `externalId`), addressed to the receiver's user, with the notification's read state.
 *
 * A notification that names a comment (`commentId`: a comment on a record the receiver follows) becomes an entry about
 * the comment, the shape a comment notification already has: entity `Comment` and the comment's id, the record in
 * the metadata (`parentEntity`, `parentEntityId`, and `commentId`) and, for a task, in `taskId` — so a client opens the
 * thread (the task at the comment, the page at its thread). A mention keeps its record (its twins are found by it).
 */
export function notificationItemInput(notification: IEmployeeNotification, userId: ID): IInboxItemUpsertInput | null {
	if (!notification?.id || !notification.tenantId || !userId) {
		return null;
	}
	const title = (notification.title ?? '').trim() || String(notification.type ?? 'Notification');
	const comment = notification.commentId && notification.entity && notification.entityId && !isDedupedNotification(notification) ? notification.commentId : null;
	if (comment) {
		return {
			tenantId: notification.tenantId,
			organizationId: notification.organizationId ?? null,
			kind: InboxItemKindEnum.NOTIFICATION,
			source: InboxItemSourceEnum.GAUZY,
			externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
			externalId: String(notification.id),
			title,
			body: notification.message ?? null,
			bodyFormat: InboxItemBodyFormatEnum.PLAIN,
			entity: BaseEntityEnum.Comment,
			entityId: comment,
			taskId: notification.entity === BaseEntityEnum.Task ? (notification.entityId ?? null) : null,
			metadata: {
				notificationId: notification.id,
				notificationType: notification.type ?? null,
				sentByEmployeeId: notification.sentByEmployeeId ?? null,
				receiverEmployeeId: notification.receiverEmployeeId ?? null,
				commentId: comment,
				parentEntity: notification.entity,
				parentEntityId: notification.entityId
			},
			recipients: [{ userId, isRead: !!notification.isRead, ...(notification.isArchived ? { isArchived: true } : {}) }]
		};
	}
	return {
		tenantId: notification.tenantId,
		organizationId: notification.organizationId ?? null,
		kind: InboxItemKindEnum.NOTIFICATION,
		source: InboxItemSourceEnum.GAUZY,
		externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
		externalId: String(notification.id),
		title,
		body: notification.message ?? null,
		bodyFormat: InboxItemBodyFormatEnum.PLAIN,
		entity: notification.entity ?? null,
		entityId: notification.entityId ?? null,
		taskId: notification.entity === BaseEntityEnum.Task ? (notification.entityId ?? null) : null,
		metadata: {
			notificationId: notification.id,
			notificationType: notification.type ?? null,
			sentByEmployeeId: notification.sentByEmployeeId ?? null,
			receiverEmployeeId: notification.receiverEmployeeId ?? null
		},
		// A notification the recovery sweep files late may already be archived through the notification API.
		recipients: [{ userId, isRead: !!notification.isRead, ...(notification.isArchived ? { isArchived: true } : {}) }]
	};
}

/** What became of a notification the bridge was asked to file (`InboxNotificationBridge.settleNotification`). */
export type InboxNotificationFiling =
	/** Filed as an item of its own. */
	| 'filed'
	/** A mention folded into its twin's item (FR-4), its id recorded there (`metadata.twinNotificationIds`). */
	| 'folded'
	/** Already filed, or already folded: nothing to do. */
	| 'present'
	/** No item can be addressed: no receiver, or a receiver with no user. */
	| 'unaddressed';

/**
 * Whether a notification is one the Inbox files once per recipient, record and kind within the window (spec FR-4):
 * a mention — the same employee mentioned twice in one page, or in two quick edits, is one thing to look at. A
 * notification without a record to key on is never a twin of another.
 */
export function isDedupedNotification(notification: Pick<IEmployeeNotification, 'type' | 'entity' | 'entityId'> | null | undefined): boolean {
	return notification?.type === EmployeeNotificationTypeEnum.MENTION && !!notification.entity && !!notification.entityId;
}

/**
 * What `twinCandidates` asks for, in one place a test can read: the receiver, the window, the record, the kind, and
 * not the notification itself. The window is the ten minutes either side of the notification's own creation (of now
 * when the notification carries no time): the live filing, which runs the moment the notification exists, and the
 * recovery sweep, which files it minutes or days later, decide the same twin and look for a recorded fold in the
 * same place.
 */
export function recentTwinCriteriaOf(
	notification: Pick<IEmployeeNotification, 'id' | 'tenantId' | 'type' | 'entity' | 'entityId'> & { createdAt?: Date | string | null },
	userId: ID,
	now = Date.now()
) {
	const created = notification.createdAt ? new Date(notification.createdAt).getTime() : NaN;
	const anchor = Number.isNaN(created) ? now : created;
	return {
		userId: String(userId),
		tenantId: String(notification.tenantId),
		since: new Date(anchor - INBOX_MENTION_DEDUPE_WINDOW_MS),
		until: new Date(anchor + INBOX_MENTION_DEDUPE_WINDOW_MS),
		kind: InboxItemKindEnum.NOTIFICATION,
		source: InboxItemSourceEnum.GAUZY,
		entity: String(notification.entity),
		entityId: String(notification.entityId),
		externalId: String(notification.id),
		type: String(notification.type)
	};
}

/** The lock a mention's check-and-file runs under: one per receiver, record and kind. */
export function twinLockNameOf(notification: Pick<IEmployeeNotification, 'tenantId' | 'type' | 'entity' | 'entityId'>, userId: ID): string {
	return `notification-twin:${notification.tenantId}:${userId}:${notification.entity}:${notification.entityId}:${notification.type}`;
}

/** An item's metadata as an object (a JSON document, or already parsed); null when it is neither. */
function metadataObject(metadata: unknown): Record<string, unknown> | null {
	let parsed: unknown = metadata;
	if (typeof metadata === 'string') {
		try {
			parsed = JSON.parse(metadata);
		} catch {
			return null;
		}
	}
	return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

/** The notification type an item was filed for, read from the metadata the bridge wrote (a JSON document, or already parsed). */
export function notificationTypeOf(metadata: unknown): string | null {
	const type = metadataObject(metadata)?.['notificationType'];
	return typeof type === 'string' ? type : null;
}

/**
 * The notifications folded into an item besides its own (`metadata.twinNotificationIds`, the many-to-one record of
 * FR-4): the mentions of the same receiver, record and kind that were not filed as entries of their own.
 */
export function twinNotificationIdsOf(metadata: unknown): string[] {
	const ids = metadataObject(metadata)?.['twinNotificationIds'];
	return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

/** Every notification row an item stands for: its own (`externalId`) and the twins folded into it. */
export function notificationIdsOf(item: { externalId?: string | null; metadata?: unknown }): string[] {
	return [...new Set([...(item?.externalId ? [String(item.externalId)] : []), ...twinNotificationIdsOf(item?.metadata)])];
}

/**
 * The unified inbox: every platform notification (an assignment, a mention, a comment on a followed record, …)
 * is filed as an inbox item of kind NOTIFICATION the moment it exists, and the two read states are kept one.
 *
 * - `EmployeeNotificationCreatedEvent` → `InboxService.upsertExternal` (idempotent on the notification id). A
 *   filing the process did not live to make is made by the recovery sweep (`InboxNotificationSweepService`), which
 *   files through `settleNotification` as well.
 * - `EmployeeNotificationUpdatedEvent` (an edit, a mark-all-read through the notification API) → the recipient
 *   rows of the filed items, written directly so nothing echoes back.
 * - The Inbox's own state changes reach the notification through this class as the `GAUZY` source handler
 *   (`onStateChange`), again written directly: no event, no echo.
 *
 * An entry stands for its own notification and for the mentions folded into it (FR-4, `metadata.twinNotificationIds`):
 * a change of the entry reaches every one of those rows, and a change of any of them reaches the entry and the others.
 *
 * Best effort throughout: a notification is never lost or delayed because the inbox could not file it.
 */
@Injectable()
export class InboxNotificationBridge implements OnModuleInit, IInboxSourceHandler {
	readonly source = InboxItemSourceEnum.GAUZY;
	private readonly logger = new Logger(InboxNotificationBridge.name);
	/** Serialises a mention's twin check and filing per receiver, record and kind, across the replicas. */
	private readonly locks: InboxNamedLocks;

	constructor(
		private readonly dataSource: DataSource,
		private readonly inbox: InboxService,
		private readonly registry: InboxSourceHandlerRegistry,
		/** Tells the observers about a mirrored change; absent in bare test wiring. */
		@Optional() private readonly feed?: InboxItemFeed,
		/** Tells the user's other clients about a mirrored change; absent in bare test wiring. */
		@Optional() private readonly realtime?: InboxRealtime
	) {
		this.locks = new InboxNamedLocks(dataSource);
	}

	onModuleInit(): void {
		if (!this.registry.get(this.source)) {
			this.registry.register(this);
		}
	}

	/** Replies to local items stay in the Inbox; nothing to route. */
	async onReply(): Promise<IInboxSourceReplyResult> {
		return { routed: 'local' };
	}

	/**
	 * A recipient's state of a filed notification changed in the Inbox: every notification row the item stands for
	 * follows — its own, and the mentions folded into it. The list is read afresh under the entry's twin lock, so a
	 * mention folded while the change was being written is reached too (see `withEntryRows`).
	 */
	async onStateChange(item: IInboxItem, recipient: IInboxItemRecipient, change: IInboxRecipientStateInput): Promise<void> {
		if (item?.externalSource !== INBOX_NOTIFICATION_EXTERNAL_SOURCE || !item.externalId || !item.tenantId) {
			return;
		}
		// Only read and archive states reach the notification rows: a snooze or done change mirrors nothing, so it
		// takes no entry lock (on MySQL a contended GET_LOCK would refuse a change that writes nothing).
		if (typeof change?.isRead !== 'boolean' && typeof change?.isArchived !== 'boolean') {
			return;
		}
		await this.withEntryRows(item.tenantId, item.id as ID, recipient?.userId as ID, (ids) =>
			this.mirrorToNotifications(item.tenantId as ID, ids, change, recipient)
		);
	}

	/**
	 * Files a notification that now exists as an inbox item of its receiver — unless it is a mention whose twin (the
	 * same receiver, record and kind) was filed within ten minutes of it: then the entry that exists is the one to
	 * look at, and the notification is recorded on it (see `settleNotification`). Best effort: a failure is logged,
	 * and the recovery sweep files the notification later.
	 */
	async fileNotification(notification: IEmployeeNotification): Promise<void> {
		try {
			await this.settleNotification(notification);
		} catch (error) {
			this.logger.warn(`Notification ${notification?.id} was not filed in the inbox: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Files one notification, once, whoever asks: the live filing the moment the notification exists, or the recovery
	 * sweep any time later. A notification whose item is complete (its receiver's recipient row exists), or that is
	 * already recorded on its twin's item, is left alone, so the two never make two entries of one notification; an
	 * item a failed write left without its recipient row is completed.
	 *
	 * A mention whose twin (the same receiver, record and kind) was filed within ten minutes of it is folded: its id is
	 * added to the twin's `metadata.twinNotificationIds`, and its row takes the entry's read / archive state, so the
	 * notification API and the Inbox agree from the start (a fold found already recorded has its state taken again,
	 * in case the first time stopped between the two writes). The check and the filing of a mention run under one lock
	 * per receiver, record and kind — the lock the entry's state changes take too — so two mentions filed at once (two
	 * replicas, one receiver named twice in a burst, or the live filing and the sweep) cannot both find no twin.
	 *
	 * `recovered` (the sweep): the entry is dated as its notification — the item and its recipient row take the
	 * notification's creation time — so it sorts where it belongs, a mention filed later folds as it would have, and
	 * the delivery lane decides it like any entry of that age.
	 *
	 * Throws what the filing threw (the sweep keeps its place and tries again); `fileNotification` logs it instead.
	 */
	async settleNotification(
		notification: IEmployeeNotification,
		options: { now?: number; recovered?: boolean } = {}
	): Promise<InboxNotificationFiling> {
		const now = options.now ?? Date.now();
		const userId = await this.userIdOfEmployee(notification?.receiverEmployeeId, notification?.tenantId);
		const input = userId ? notificationItemInput(notification, userId) : null;
		if (!input) {
			return 'unaddressed';
		}
		const file = async (): Promise<InboxNotificationFiling> => {
			const { item } = await this.inbox.upsertExternal(input);
			if (options.recovered) {
				await this.dateAsNotified(item.id as ID, notification);
			}
			return 'filed';
		};
		if (!isDedupedNotification(notification)) {
			if ((await this.filingOf(notification, userId as ID)) === 'complete') {
				return 'present';
			}
			await this.withCommentParent(input);
			return file();
		}
		// A comment's task and record join the item first; the twin check keys on the notification alone.
		await this.withCommentParent(input);
		return this.locks.run(twinLockNameOf(notification, userId as ID), async (): Promise<InboxNotificationFiling> => {
			const filing = await this.filingOf(notification, userId as ID);
			if (filing === 'complete') {
				return 'present';
			}
			if (filing === 'partial') {
				return file();
			}
			const twins = (await this.twinCandidates(notification, userId as ID, now)).filter(
				(row) => notificationTypeOf(row.metadata) === String(notification.type)
			);
			const recorded = twins.find((row) => twinNotificationIdsOf(row.metadata).includes(String(notification.id)));
			if (recorded) {
				await this.alignTwin(recorded.id, notification, userId as ID);
				return 'present';
			}
			const twin = twins[0];
			if (twin) {
				this.logger.debug(
					`Notification ${notification.id} is folded into inbox item ${twin.id}: a ${notification.type} on ${notification.entity} ${notification.entityId} reached user ${userId} within ${INBOX_MENTION_DEDUPE_WINDOW_MS / 60_000} minutes of it`
				);
				await this.recordTwin(twin.id, notification);
				await this.alignTwin(twin.id, notification, userId as ID);
				return 'folded';
			}
			return file();
		});
	}

	/**
	 * Whether the notification has its own item, and whether that item is complete — the receiver's recipient row
	 * exists (`InboxService.write` saves the item first, so a failed recipient write leaves an item nobody sees).
	 */
	private async filingOf(notification: IEmployeeNotification, userId: ID): Promise<'complete' | 'partial' | null> {
		const tenantId = notification.tenantId as ID;
		const item = await this.dataSource.getRepository(InboxItem).findOne({
			select: { id: true },
			where: { tenantId, externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE, externalId: String(notification.id) }
		});
		if (!item) {
			return null;
		}
		const recipient = await this.dataSource
			.getRepository(InboxItemRecipient)
			.findOne({ select: { id: true }, where: { tenantId, inboxItemId: item.id as ID, userId } });
		return recipient ? 'complete' : 'partial';
	}

	/** Dates a recovered entry, and its recipient rows, as the notification it stands for (never later than now). */
	private async dateAsNotified(itemId: ID, notification: IEmployeeNotification): Promise<void> {
		const created = notification.createdAt ? new Date(notification.createdAt) : null;
		if (!created || Number.isNaN(created.getTime()) || created.getTime() > Date.now()) {
			return;
		}
		await this.dataSource.getRepository(InboxItem).update({ id: itemId }, { createdAt: created } as never);
		await this.dataSource
			.getRepository(InboxItemRecipient)
			.update({ inboxItemId: itemId, tenantId: notification.tenantId as ID }, { createdAt: created } as never);
	}

	/**
	 * The user's items on the notification's record whose recipient row was created within ten minutes of the
	 * notification, newest first, the notification's own excluded: the entries a mention can be folded into, and so
	 * the only ones it can have been folded into (a recovered entry is dated as its notification, see
	 * `dateAsNotified`). One query over the user's recipient rows of the window joined to their items on the record
	 * (no cap — a busy receiver's tenth minute is as long as anyone's); the kind is read from the metadata by the
	 * caller, which the database cannot read.
	 */
	private async twinCandidates(
		notification: IEmployeeNotification,
		userId: ID,
		now = Date.now()
	): Promise<Array<{ id: ID; metadata?: unknown }>> {
		const criteria = recentTwinCriteriaOf(notification, userId, now);
		return (await this.dataSource
			.getRepository(InboxItemRecipient)
			.createQueryBuilder('recipient')
			.innerJoin(InboxItem, 'item', 'item.id = recipient.inboxItemId AND item.tenantId = recipient.tenantId')
			.select('item.id', 'id')
			.addSelect('item.metadata', 'metadata')
			.where(
				'recipient.userId = :userId AND recipient.tenantId = :tenantId AND recipient.createdAt >= :since AND recipient.createdAt <= :until',
				criteria
			)
			.andWhere('item.kind = :kind AND item.source = :source AND item.entity = :entity AND item.entityId = :entityId')
			.andWhere('(item.externalId IS NULL OR item.externalId != :externalId)')
			.orderBy('recipient.createdAt', 'DESC')
			.getRawMany()) as Array<{ id: ID; metadata?: unknown }>;
	}

	/**
	 * Records a folded mention on its twin's item (`metadata.twinNotificationIds`, written directly: a fact of the
	 * mapping, not a change anyone is told about). Runs under the twin lock, which every fold into this item and every
	 * state change of it takes, so the read and the write of the metadata are not interleaved with either.
	 */
	private async recordTwin(itemId: ID, notification: IEmployeeNotification): Promise<void> {
		const notificationId = String(notification.id);
		const items = this.dataSource.getRepository(InboxItem);
		const item = await items.findOne({ where: { id: itemId, tenantId: notification.tenantId as ID } });
		if (!item) {
			return;
		}
		const metadata = metadataObject(item.metadata) ?? {};
		const twins = twinNotificationIdsOf(metadata);
		if (!twins.includes(notificationId)) {
			await items.update(
				{ id: item.id },
				{ metadata: JSON.stringify({ ...metadata, twinNotificationIds: [...twins, notificationId] }) }
			);
		}
	}

	/** Gives a folded mention's row the entry's current read / archive state for the receiver (idempotent). */
	private async alignTwin(itemId: ID, notification: IEmployeeNotification, userId: ID): Promise<void> {
		const tenantId = notification.tenantId as ID;
		const recipient = await this.dataSource
			.getRepository(InboxItemRecipient)
			.findOne({ where: { tenantId, inboxItemId: itemId, userId } });
		if (recipient) {
			await this.mirrorToNotifications(
				tenantId,
				[String(notification.id)],
				{ isRead: !!recipient.isRead, isArchived: !!recipient.isArchived },
				recipient
			);
		}
	}

	/**
	 * Runs `work` with every notification row an entry stands for, read afresh. For a mention entry it runs under the
	 * entry's twin lock (the lock its folds take), so a state change and a fold are serialised: a fold either comes
	 * first, and is in the list, or comes after, and reads the state already written.
	 */
	private async withEntryRows(tenantId: ID, itemId: ID, userId: ID | undefined, work: (ids: string[]) => Promise<void>): Promise<void> {
		const items = this.dataSource.getRepository(InboxItem);
		const item = await items.findOne({ where: { id: itemId, tenantId } });
		if (!item) {
			return;
		}
		// The entry as the notification it was filed for: the lock its folds take is named after these.
		const entry = {
			tenantId,
			type: notificationTypeOf(item.metadata),
			entity: item.entity,
			entityId: item.entityId
		} as Pick<IEmployeeNotification, 'tenantId' | 'type' | 'entity' | 'entityId'>;
		if (!userId || !isDedupedNotification(entry)) {
			return work(notificationIdsOf(item));
		}
		await this.locks.run(twinLockNameOf(entry, userId), async () => {
			const fresh = await items.findOne({ where: { id: itemId, tenantId } });
			await work(notificationIdsOf(fresh ?? item));
		});
	}

	/**
	 * Writes a read / archive state onto notification rows, directly (no event, so nothing echoes back): only the rows
	 * whose state differs, each date following its state (a cleared state clears its date).
	 */
	private async mirrorToNotifications(
		tenantId: ID,
		ids: string[],
		change: IInboxRecipientStateInput,
		recipient?: Pick<IInboxItemRecipient, 'readAt' | 'archivedAt'> | null
	): Promise<void> {
		const patch: Partial<EmployeeNotification> = {};
		if (typeof change?.isRead === 'boolean') {
			patch.isRead = change.isRead;
			// A cleared state clears its date: an undefined member would leave the old one in place.
			patch.readAt = change.isRead ? (recipient?.readAt ?? new Date()) : (null as never);
		}
		if (typeof change?.isArchived === 'boolean') {
			patch.isArchived = change.isArchived;
			patch.archivedAt = change.isArchived ? (recipient?.archivedAt ?? new Date()) : (null as never);
		}
		const targets = ids.filter((id) => typeof id === 'string' && id.length > 0);
		if (!Object.keys(patch).length || !targets.length) {
			return;
		}
		const repository = this.dataSource.getRepository(EmployeeNotification);
		const rows = await repository.find({
			select: { id: true, isRead: true, isArchived: true },
			where: { id: In(targets as ID[]), tenantId }
		});
		const stale = rows.filter(
			(row) =>
				(patch.isRead !== undefined && !!row.isRead !== patch.isRead) ||
				(patch.isArchived !== undefined && !!row.isArchived !== patch.isArchived)
		);
		if (!stale.length) {
			return;
		}
		await repository.update({ id: In(stale.map((row) => row.id as ID)) }, patch as never);
	}

	/**
	 * The notification API changed read / archive state: the recipient rows of the items standing for those
	 * notifications follow — the items filed for them, and the items they were folded into — and so do the other
	 * notification rows those items stand for (one entry, one state). Mark-all-read reaches every row itself.
	 */
	async mirrorNotificationState(change: IEmployeeNotificationStateChange): Promise<void> {
		try {
			if (!change?.tenantId || (change.isRead === undefined && change.isArchived === undefined)) {
				return;
			}
			const userId = await this.userIdOfEmployee(change.receiverEmployeeId ?? undefined, change.tenantId);
			if (!userId) {
				return;
			}
			const items = await this.dataSource.getRepository(InboxItem).find({
				where: {
					tenantId: change.tenantId,
					externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
					...(change.ids === 'all' ? {} : { externalId: In(change.ids.map(String)) })
				}
			});
			if (change.ids !== 'all') {
				const known = new Set(items.map((item) => String(item.id)));
				for (const item of await this.itemsFolding(change.tenantId, userId, change.ids.map(String))) {
					if (!known.has(String(item.id))) {
						known.add(String(item.id));
						items.push(item);
					}
				}
			}
			if (!items.length) {
				return;
			}
			await this.mirrorToRecipients(change, userId, items);
			if (change.ids !== 'all') {
				// The entries' other rows take the same state (written directly: no event, no echo), each entry's list
				// read afresh under its twin lock, as an Inbox change does.
				const stated = new Set(change.ids.map(String));
				for (const item of items) {
					await this.withEntryRows(change.tenantId, item.id as ID, userId, (ids) =>
						this.mirrorToNotifications(
							change.tenantId,
							ids.filter((id) => !stated.has(id)),
							{ isRead: change.isRead, isArchived: change.isArchived }
						)
					);
				}
			}
		} catch (error) {
			this.logger.warn(`The notification state change was not mirrored to the inbox: ${(error as Error)?.message}`);
		}
	}

	/**
	 * The items a mention was folded into, for each of the notifications that is a mention on a record: looked for
	 * where a fold can happen (the receiver's items on the record within ten minutes of the notification).
	 */
	private async itemsFolding(tenantId: ID, userId: ID, ids: string[]): Promise<InboxItem[]> {
		if (!ids.length) {
			return [];
		}
		const notifications = await this.dataSource.getRepository(EmployeeNotification).find({
			select: { id: true, tenantId: true, type: true, entity: true, entityId: true, createdAt: true },
			where: { id: In(ids as ID[]), tenantId }
		});
		const folding = new Set<string>();
		for (const notification of notifications.filter((row) => isDedupedNotification(row))) {
			for (const row of await this.twinCandidates(notification, userId)) {
				if (twinNotificationIdsOf(row.metadata).includes(String(notification.id))) {
					folding.add(String(row.id));
				}
			}
		}
		if (!folding.size) {
			return [];
		}
		return this.dataSource.getRepository(InboxItem).find({ where: { id: In([...folding] as ID[]), tenantId } });
	}

	/** The receiver's recipient rows of the items take the notification API's change; the change is announced. */
	private async mirrorToRecipients(change: IEmployeeNotificationStateChange, userId: ID, items: InboxItem[]): Promise<void> {
		const itemById = new Map(items.map((item) => [String(item.id), item]));
		const now = new Date();
		const recipients = this.dataSource.getRepository(InboxItemRecipient);
		const where = { tenantId: change.tenantId, userId, inboxItemId: In(items.map((item) => item.id)) };
		const changed: Array<{ recipient: InboxItemRecipient; stated: IInboxRecipientStateField[] }> = [];
		if (change.isRead !== undefined) {
			// Mark-all-read leaves archived notifications unread; the mirror leaves their copies alone too.
			const criteria = { ...where, isRead: !change.isRead, ...(change.ids === 'all' ? { isArchived: false } : {}) };
			const rows = await recipients.find({ where: criteria });
			if (rows.length) {
				await recipients.update(
					{ id: In(rows.map((row) => row.id)) },
					change.isRead ? { isRead: true, readAt: now } : { isRead: false, readAt: null as never }
				);
				changed.push(...rows.map((recipient) => ({ recipient, stated: ['isRead'] as IInboxRecipientStateField[] })));
			}
		}
		if (change.isArchived !== undefined) {
			const rows = await recipients.find({ where: { ...where, isArchived: !change.isArchived } });
			if (rows.length) {
				await recipients.update(
					{ id: In(rows.map((row) => row.id)) },
					change.isArchived ? { isArchived: true, archivedAt: now } : { isArchived: false, archivedAt: null as never }
				);
				changed.push(...rows.map((recipient) => ({ recipient, stated: ['isArchived'] as IInboxRecipientStateField[] })));
			}
		}
		if (changed.length) {
			this.announce(change.tenantId, userId, itemById, changed);
		}
	}

	/**
	 * A mirrored change is a change like any other to the observers and to the user's other clients: the feed hears
	 * one recipient change per row, the channel one `inbox_item.state_changed` per organization of the items. The
	 * source handler is not called (the change came from the source), so nothing echoes. Best effort.
	 */
	private announce(
		tenantId: ID,
		userId: ID,
		itemById: Map<string, InboxItem>,
		changed: Array<{ recipient: InboxItemRecipient; stated: IInboxRecipientStateField[] }>
	): void {
		if (this.feed?.observed) {
			for (const { recipient, stated } of changed) {
				const item = itemById.get(String(recipient.inboxItemId));
				if (item) void this.feed.recipientChanged(item, recipient, stated);
			}
		}
		if (!this.realtime) {
			return;
		}
		const byOrganization = new Map<string, { organizationId: ID | null; itemIds: Set<ID>; stated: Set<string> }>();
		for (const { recipient, stated } of changed) {
			const item = itemById.get(String(recipient.inboxItemId));
			if (!item) continue;
			const organizationId = (item.organizationId as ID | null | undefined) ?? null;
			const key = String(organizationId ?? '');
			const group = byOrganization.get(key) ?? { organizationId, itemIds: new Set<ID>(), stated: new Set<string>() };
			group.itemIds.add(item.id as ID);
			for (const field of stated) group.stated.add(field);
			byOrganization.set(key, group);
		}
		for (const group of byOrganization.values()) {
			void this.realtime.recipientStateChanged({
				tenantId,
				organizationId: group.organizationId,
				userId,
				itemIds: [...group.itemIds],
				stated: [...group.stated]
			});
		}
	}

	/**
	 * A notification about a comment (a comment on a record the receiver follows, a mention in one) names the comment;
	 * the item also names the comment's task, so a client opens the task at the comment, and keeps the comment's record
	 * in its metadata (`parentEntity`, `parentEntityId`) for the records that are not tasks. Best effort: a comment that
	 * cannot be read leaves the item as the notification names it.
	 */
	private async withCommentParent(input: IInboxItemUpsertInput): Promise<void> {
		if (input.entity !== BaseEntityEnum.Comment || !input.entityId || input.taskId) {
			return;
		}
		// The notification named the record itself (a comment on a followed record): nothing to read.
		if (input.metadata?.['parentEntity'] && input.metadata?.['parentEntityId']) {
			return;
		}
		try {
			const comment = await this.dataSource.getRepository<{ id: ID; entity?: string | null; entityId?: ID | null }>('Comment').findOne({
				select: { id: true, entity: true, entityId: true },
				where: { id: input.entityId, tenantId: input.tenantId }
			} as never);
			if (!comment?.entity || !comment.entityId) {
				return;
			}
			if (comment.entity === BaseEntityEnum.Task) {
				input.taskId = comment.entityId;
			}
			input.metadata = { ...(input.metadata ?? {}), parentEntity: comment.entity, parentEntityId: comment.entityId };
		} catch (error) {
			this.logger.warn(`Notification ${input.externalId}: the comment's record was not read (${(error as Error)?.message})`);
		}
	}

	/** The user behind an employee of the tenant. */
	private async userIdOfEmployee(employeeId: ID | undefined | null, tenantId: ID | undefined | null): Promise<ID | null> {
		if (!employeeId) {
			return null;
		}
		const employee = await this.dataSource.getRepository(Employee).findOne({
			select: { id: true, userId: true },
			where: { id: employeeId, ...(tenantId ? { tenantId } : {}) }
		});
		return (employee?.userId as ID) ?? null;
	}
}

/** A notification row exists: file it. */
@EventsHandler(EmployeeNotificationCreatedEvent)
export class InboxNotificationCreatedHandler implements IEventHandler<EmployeeNotificationCreatedEvent> {
	constructor(private readonly bridge: InboxNotificationBridge) {}

	async handle(event: EmployeeNotificationCreatedEvent): Promise<void> {
		await this.bridge.fileNotification(event.notification);
	}
}

/** A notification's read / archive state changed through its own API: mirror it. */
@EventsHandler(EmployeeNotificationUpdatedEvent)
export class InboxNotificationUpdatedHandler implements IEventHandler<EmployeeNotificationUpdatedEvent> {
	constructor(private readonly bridge: InboxNotificationBridge) {}

	async handle(event: EmployeeNotificationUpdatedEvent): Promise<void> {
		await this.bridge.mirrorNotificationState(event.change);
	}
}

export const INBOX_NOTIFICATION_HANDLERS = [InboxNotificationCreatedHandler, InboxNotificationUpdatedHandler];
