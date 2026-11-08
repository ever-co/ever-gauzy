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
 */
export function notificationItemInput(notification: IEmployeeNotification, userId: ID): IInboxItemUpsertInput | null {
	if (!notification?.id || !notification.tenantId || !userId) {
		return null;
	}
	const title = (notification.title ?? '').trim() || String(notification.type ?? 'Notification');
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
		recipients: [{ userId, isRead: !!notification.isRead }]
	};
}

/**
 * Whether a notification is one the Inbox files once per recipient, record and kind within the window (spec FR-4):
 * a mention — the same employee mentioned twice in one page, or in two quick edits, is one thing to look at. A
 * notification without a record to key on is never a twin of another.
 */
export function isDedupedNotification(notification: Pick<IEmployeeNotification, 'type' | 'entity' | 'entityId'> | null | undefined): boolean {
	return notification?.type === EmployeeNotificationTypeEnum.MENTION && !!notification.entity && !!notification.entityId;
}

/** The notification type an item was filed for, read from the metadata the bridge wrote (a JSON document, or already parsed). */
/** What `hasRecentTwin` asks for, in one place a test can read: the receiver, the window, the record, the kind, and not the notification itself. */
export function recentTwinCriteriaOf(notification: Pick<IEmployeeNotification, 'id' | 'tenantId' | 'type' | 'entity' | 'entityId'>, userId: ID, now = Date.now()) {
	return {
		userId: String(userId),
		tenantId: String(notification.tenantId),
		since: new Date(now - INBOX_MENTION_DEDUPE_WINDOW_MS),
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

export function notificationTypeOf(metadata: unknown): string | null {
	let parsed: unknown = metadata;
	if (typeof metadata === 'string') {
		try {
			parsed = JSON.parse(metadata);
		} catch {
			return null;
		}
	}
	const type = (parsed as { notificationType?: unknown } | null)?.notificationType;
	return typeof type === 'string' ? type : null;
}

/**
 * The unified inbox: every platform notification (an assignment, a mention, a comment on a followed record, …)
 * is filed as an inbox item of kind NOTIFICATION the moment it exists, and the two read states are kept one.
 *
 * - `EmployeeNotificationCreatedEvent` → `InboxService.upsertExternal` (idempotent on the notification id).
 * - `EmployeeNotificationUpdatedEvent` (an edit, a mark-all-read through the notification API) → the recipient
 *   rows of the filed items, written directly so nothing echoes back.
 * - The Inbox's own state changes reach the notification through this class as the `GAUZY` source handler
 *   (`onStateChange`), again written directly: no event, no echo.
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

	/** A recipient's state of a filed notification changed in the Inbox: the notification row follows. */
	async onStateChange(item: IInboxItem, recipient: IInboxItemRecipient, change: IInboxRecipientStateInput): Promise<void> {
		if (item?.externalSource !== INBOX_NOTIFICATION_EXTERNAL_SOURCE || !item.externalId || !item.tenantId) {
			return;
		}
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
		if (!Object.keys(patch).length) {
			return;
		}
		const repository = this.dataSource.getRepository(EmployeeNotification);
		const row = await repository.findOne({ where: { id: item.externalId as ID, tenantId: item.tenantId } });
		if (!row) {
			return;
		}
		const differs =
			(patch.isRead !== undefined && !!row.isRead !== patch.isRead) ||
			(patch.isArchived !== undefined && !!row.isArchived !== patch.isArchived);
		if (!differs) {
			return;
		}
		await repository.update({ id: row.id }, patch as never);
	}

	/**
	 * Files a notification that now exists as an inbox item of its receiver — unless it is a mention whose twin (the
	 * same receiver, record and kind) was filed within the last ten minutes: then the entry that exists is the one to
	 * look at, and the notification row stays what the Notifications tab reads. The check and the filing run under
	 * one lock per receiver, record and kind, so two mentions filed at once (two replicas, or one receiver named
	 * twice in a burst) cannot both find no twin.
	 */
	async fileNotification(notification: IEmployeeNotification): Promise<void> {
		try {
			const userId = await this.userIdOfEmployee(notification?.receiverEmployeeId, notification?.tenantId);
			const input = userId ? notificationItemInput(notification, userId) : null;
			if (!input) {
				return;
			}
			// A comment's task and record join the item first; the twin check keys on the notification alone.
			await this.withCommentParent(input);
			if (!isDedupedNotification(notification)) {
				await this.inbox.upsertExternal(input);
				return;
			}
			await this.locks.run(twinLockNameOf(notification, userId as ID), async () => {
				if (await this.hasRecentTwin(notification, userId as ID)) {
					this.logger.debug(`Notification ${notification.id} is not filed: a ${notification.type} on ${notification.entity} ${notification.entityId} reached user ${userId} within the last ${INBOX_MENTION_DEDUPE_WINDOW_MS / 60_000} minutes`);
					return;
				}
				await this.inbox.upsertExternal(input);
			});
		} catch (error) {
			this.logger.warn(`Notification ${notification?.id} was not filed in the inbox: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Whether an item of the same kind, on the same record, reached the user within the window: one query over the
	 * user's recipient rows of the window joined to their items on the record (no cap — a busy receiver's tenth
	 * minute is as long as anyone's), the kind compared from the metadata, which the database cannot read.
	 */
	private async hasRecentTwin(notification: IEmployeeNotification, userId: ID, now = Date.now()): Promise<boolean> {
		const criteria = recentTwinCriteriaOf(notification, userId, now);
		const rows = (await this.dataSource
			.getRepository(InboxItemRecipient)
			.createQueryBuilder('recipient')
			.innerJoin(InboxItem, 'item', 'item.id = recipient.inboxItemId AND item.tenantId = recipient.tenantId')
			.select('item.metadata', 'metadata')
			.where('recipient.userId = :userId AND recipient.tenantId = :tenantId AND recipient.createdAt >= :since', criteria)
			.andWhere('item.kind = :kind AND item.source = :source AND item.entity = :entity AND item.entityId = :entityId')
			.andWhere('(item.externalId IS NULL OR item.externalId != :externalId)')
			.getRawMany()) as Array<{ metadata?: unknown }>;
		return rows.some((row) => notificationTypeOf(row.metadata) === criteria.type);
	}

	/** The notification API changed read / archive state: the filed items' recipient rows follow. */
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
			if (!items.length) {
				return;
			}
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
		} catch (error) {
			this.logger.warn(`The notification state change was not mirrored to the inbox: ${(error as Error)?.message}`);
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
