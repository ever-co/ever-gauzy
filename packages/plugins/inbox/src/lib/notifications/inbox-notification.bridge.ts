import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource, In, MoreThanOrEqual } from 'typeorm';
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

	constructor(
		private readonly dataSource: DataSource,
		private readonly inbox: InboxService,
		private readonly registry: InboxSourceHandlerRegistry,
		/** Tells the observers about a mirrored change; absent in bare test wiring. */
		@Optional() private readonly feed?: InboxItemFeed,
		/** Tells the user's other clients about a mirrored change; absent in bare test wiring. */
		@Optional() private readonly realtime?: InboxRealtime
	) {}

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
	 * look at, and the notification row stays what the Notifications tab reads.
	 */
	async fileNotification(notification: IEmployeeNotification): Promise<void> {
		try {
			const userId = await this.userIdOfEmployee(notification?.receiverEmployeeId, notification?.tenantId);
			const input = userId ? notificationItemInput(notification, userId) : null;
			if (!input) {
				return;
			}
			if (isDedupedNotification(notification) && (await this.hasRecentTwin(notification, userId as ID))) {
				this.logger.debug(`Notification ${notification.id} is not filed: a ${notification.type} on ${notification.entity} ${notification.entityId} reached user ${userId} within the last ${INBOX_MENTION_DEDUPE_WINDOW_MS / 60_000} minutes`);
				return;
			}
			await this.inbox.upsertExternal(input);
		} catch (error) {
			this.logger.warn(`Notification ${notification?.id} was not filed in the inbox: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Whether an item of the same kind, on the same record, reached the user within the window: the user's recipient
	 * rows of the window (few), then their items narrowed to the record, the type compared from the metadata.
	 */
	private async hasRecentTwin(notification: IEmployeeNotification, userId: ID, now = Date.now()): Promise<boolean> {
		const since = new Date(now - INBOX_MENTION_DEDUPE_WINDOW_MS);
		const recent = await this.dataSource.getRepository(InboxItemRecipient).find({
			select: { inboxItemId: true },
			where: { userId, tenantId: notification.tenantId, createdAt: MoreThanOrEqual(since) },
			take: 200
		} as never);
		const itemIds = recent.map((row) => row.inboxItemId).filter(Boolean);
		if (!itemIds.length) {
			return false;
		}
		const items = await this.dataSource.getRepository(InboxItem).find({
			select: { id: true, externalId: true, metadata: true },
			where: {
				id: In(itemIds),
				tenantId: notification.tenantId,
				kind: InboxItemKindEnum.NOTIFICATION,
				source: InboxItemSourceEnum.GAUZY,
				entity: notification.entity,
				entityId: notification.entityId
			}
		} as never);
		return items.some((item) => String(item.externalId ?? '') !== String(notification.id) && notificationTypeOf(item.metadata) === String(notification.type));
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
