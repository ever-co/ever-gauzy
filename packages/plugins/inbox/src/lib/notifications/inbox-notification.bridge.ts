import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import {
	BaseEntityEnum,
	ID,
	IEmployeeNotification,
	IInboxItem,
	IInboxItemRecipient,
	IInboxItemUpsertInput,
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
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxService } from '../inbox.service';

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
		private readonly registry: InboxSourceHandlerRegistry
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
			patch.readAt = change.isRead ? (recipient?.readAt ?? new Date()) : undefined;
		}
		if (typeof change?.isArchived === 'boolean') {
			patch.isArchived = change.isArchived;
			patch.archivedAt = change.isArchived ? (recipient?.archivedAt ?? new Date()) : undefined;
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

	/** Files a notification that now exists as an inbox item of its receiver. */
	async fileNotification(notification: IEmployeeNotification): Promise<void> {
		try {
			const userId = await this.userIdOfEmployee(notification?.receiverEmployeeId, notification?.tenantId);
			const input = userId ? notificationItemInput(notification, userId) : null;
			if (!input) {
				return;
			}
			await this.inbox.upsertExternal(input);
		} catch (error) {
			this.logger.warn(`Notification ${notification?.id} was not filed in the inbox: ${(error as Error)?.message}`);
		}
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
				select: { id: true },
				where: {
					tenantId: change.tenantId,
					externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
					...(change.ids === 'all' ? {} : { externalId: In(change.ids.map(String)) })
				}
			});
			if (!items.length) {
				return;
			}
			const now = new Date();
			const recipients = this.dataSource.getRepository(InboxItemRecipient);
			const where = { tenantId: change.tenantId, userId, inboxItemId: In(items.map((item) => item.id)) };
			if (change.isRead !== undefined) {
				await recipients.update(
					{ ...where, isRead: !change.isRead },
					change.isRead ? { isRead: true, readAt: now } : { isRead: false, readAt: null as never }
				);
			}
			if (change.isArchived !== undefined) {
				await recipients.update(
					{ ...where, isArchived: !change.isArchived },
					change.isArchived ? { isArchived: true, archivedAt: now } : { isArchived: false, archivedAt: null as never }
				);
			}
		} catch (error) {
			this.logger.warn(`The notification state change was not mirrored to the inbox: ${(error as Error)?.message}`);
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
