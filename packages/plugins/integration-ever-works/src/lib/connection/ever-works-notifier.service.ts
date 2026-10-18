import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IInboxItemWriter,
	INBOX_ITEM_WRITER,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { Employee, EmployeeNotification, IntegrationTenant } from '@gauzy/core';
import { EVER_WORKS_INTEGRATION_NAME } from '../ever-works.constants';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksConnection } from './ever-works-connection.entity';

/** The identity of the integration's notices in the Inbox: one item per connection and kind of notice. */
export const EVER_WORKS_NOTICE_SOURCE = 'ever_works_notice';

/** The notices the integration sends to the admin who connected it. */
export type EverWorksNoticeKind = 'needs_reauth' | 'dead_letter';

/** What a dead letter was (the record a change stopped on). */
export interface EverWorksDeadLetter {
	direction: 'inbound' | 'outbound';
	/** The record's type, e.g. `task`, `team`. */
	entityType: string;
	/** The record's id on the side the change came from. */
	recordId?: string | null;
	/** Why it stopped (an error message; shortened). */
	reason: string;
}

interface EverWorksNotice {
	kind: EverWorksNoticeKind;
	title: string;
	message: string;
	priority: InboxItemPriorityEnum;
	metadata?: Record<string, unknown>;
}

/**
 * Notices for the admin who connected Ever Works (plan 06 G-P3-5).
 *
 * - **Where the Inbox is loaded** (`GAUZY_INBOX_ENABLED=true`): an Inbox `NOTICE` from `source = SYSTEM`,
 *   one per connection, kind and admin (`ever_works_notice` / `<connectionId>:<kind>:<userId>`). A repeat updates it and marks
 *   it unread and not archived again, so a recurring problem resurfaces instead of piling up. The admin needs no
 *   employee record.
 * - **Otherwise**, or when the Inbox refuses: the earlier fallback, an employee notification (the bell of
 *   Gauzy and Ever Teams) for that admin's employee in the organization the connection was made from. An admin
 *   without an employee record there gets the notice in the API log only.
 * - Once that organization is deleted (the connection is kept with `organizationId` NULL, review F59), the notices
 *   go to the organization of the oldest active mapping through the connection.
 */
@Injectable()
export class EverWorksNotifier {
	private readonly logger = new Logger('EverWorksNotifier');

	constructor(
		private readonly dataSource: DataSource,
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null
	) {}

	/** Ever Works answered 401: the key was revoked or expired, and the sync is paused. */
	async needsReauth(connection: EverWorksConnection): Promise<boolean> {
		return this.notify(connection, {
			kind: 'needs_reauth',
			title: 'Ever Works needs a new key',
			message:
				'Ever Works no longer accepts the integration key of this Gauzy tenant, so the sync is paused. Open Integrations → Ever Works and enter a new integration key.',
			priority: InboxItemPriorityEnum.HIGH,
			metadata: { status: connection.status }
		});
	}

	/**
	 * A change stopped for good (a dead letter, or a refusal that retrying does not change). Sent to the
	 * Inbox only: there it is one notice per connection that names the latest record, while an employee
	 * notification per record would flood the bell.
	 */
	async deadLetter(connection: EverWorksConnection, letter: EverWorksDeadLetter): Promise<boolean> {
		if (!this.inbox) return false;
		const record = `${letter.direction === 'inbound' ? 'from Ever Works' : 'to Ever Works'}: ${letter.entityType}${letter.recordId ? ` ${letter.recordId}` : ''}`;
		return this.notify(
			connection,
			{
				kind: 'dead_letter',
				title: 'Ever Works sync stopped on a record',
				message: `A change could not be synced and will not be retried (${record}). Reason: ${letter.reason.slice(0, 500)}. Open Integrations → Ever Works → Activity to see every stopped change.`,
				priority: InboxItemPriorityEnum.NORMAL,
				metadata: {
					direction: letter.direction,
					entityType: letter.entityType,
					recordId: letter.recordId ?? null,
					reason: letter.reason.slice(0, 2000)
				}
			},
			{ fallback: false }
		);
	}

	private async notify(
		connection: EverWorksConnection,
		notice: EverWorksNotice,
		options: { fallback: boolean } = { fallback: true }
	): Promise<boolean> {
		const tenantId = connection.tenantId as ID | undefined;
		const organizationId =
			(connection.organizationId as ID | undefined) || (await this.mappedOrganizationOf(connection));
		const userId = connection.connectedByUserId as ID | undefined;
		if (!tenantId || !organizationId || !userId) {
			this.logger.warn(`Connection ${connection.id}: ${notice.title} (no admin to notify).`);
			return false;
		}
		if (this.inbox && (await this.toInbox(connection, notice, { tenantId, organizationId, userId }))) {
			return true;
		}
		return options.fallback
			? this.toEmployeeNotification(connection, notice, { tenantId, organizationId, userId })
			: false;
	}

	/**
	 * Where a connection's notices go once the organization it was connected from is deleted (its `organizationId`
	 * is NULL then, review F59): the organization of an active mapping through the connection, the oldest first.
	 */
	private async mappedOrganizationOf(connection: EverWorksConnection): Promise<ID | undefined> {
		if (!connection.tenantId) return undefined;
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: {
				tenantId: connection.tenantId,
				name: EVER_WORKS_INTEGRATION_NAME,
				isActive: true,
				isArchived: false
			} as never,
			relations: { settings: true } as never,
			order: { createdAt: 'ASC' } as never
		});
		const mapping = mappings.find((row) =>
			row.settings?.some(
				(setting) =>
					setting.settingsName === EverWorksSettingName.CONNECTION_ID &&
					setting.settingsValue === connection.id
			)
		);
		return (mapping?.organizationId as ID | undefined) ?? undefined;
	}

	/** The Inbox notice; `false` when the Inbox did not deliver it (the caller falls back). */
	private async toInbox(
		connection: EverWorksConnection,
		notice: EverWorksNotice,
		scope: { tenantId: ID; organizationId: ID; userId: ID }
	): Promise<boolean> {
		try {
			const result = await this.inbox!.upsertExternal({
				tenantId: scope.tenantId,
				organizationId: scope.organizationId,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				externalSource: EVER_WORKS_NOTICE_SOURCE,
				// The admin is part of the identity: after a reconnect by another admin, the earlier one keeps
				// their old notice but never sees the new admin's failures (an item's recipients only grow).
				externalId: `${connection.id}:${notice.kind}:${scope.userId}`,
				title: notice.title,
				body: notice.message,
				priority: notice.priority,
				entity: BaseEntityEnum.Organization,
				entityId: scope.organizationId,
				metadata: {
					integration: 'ever_works',
					connectionId: connection.id,
					notice: notice.kind,
					notifiedAt: new Date().toISOString(),
					...notice.metadata
				},
				// Unread and not archived again: a repeat resurfaces the notice.
				recipients: [{ userId: scope.userId, isRead: false, isArchived: false }]
			});
			if (result.recipientUserIds.includes(scope.userId)) return true;
			this.logger.warn(`Connection ${connection.id}: the Inbox did not deliver "${notice.title}" to the admin.`);
			return false;
		} catch (error) {
			this.logger.warn(
				`Connection ${connection.id}: the Inbox refused "${notice.title}" (${error instanceof Error ? error.message : 'error'}).`
			);
			return false;
		}
	}

	private async toEmployeeNotification(
		connection: EverWorksConnection,
		notice: EverWorksNotice,
		scope: { tenantId: ID; organizationId: ID; userId: ID }
	): Promise<boolean> {
		const { tenantId, organizationId, userId } = scope;
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { tenantId, organizationId, userId, isActive: true, isArchived: false },
			select: { id: true }
		});
		if (!employee?.id) {
			this.logger.warn(
				`Connection ${connection.id}: ${notice.title} (the admin has no employee record to notify).`
			);
			return false;
		}
		await this.dataSource.getRepository(EmployeeNotification).save(
			this.dataSource.getRepository(EmployeeNotification).create({
				id: randomUUID(),
				tenantId,
				organizationId,
				entity: BaseEntityEnum.Organization,
				entityId: organizationId,
				title: notice.title,
				message: notice.message,
				type: EmployeeNotificationTypeEnum.BROADCAST,
				isRead: false,
				receiverEmployeeId: employee.id
			})
		);
		return true;
	}
}
