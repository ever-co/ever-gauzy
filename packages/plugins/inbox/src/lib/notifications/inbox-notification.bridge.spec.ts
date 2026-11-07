import { BaseEntityEnum, EmployeeNotificationTypeEnum, InboxItemKindEnum, InboxItemSourceEnum, INBOX_NOTIFICATION_EXTERNAL_SOURCE } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxService } from '../inbox.service';
import { InboxNotificationBridge, isDedupedNotification, notificationItemInput, notificationTypeOf } from './inbox-notification.bridge';

describe('notificationItemInput', () => {
	const notification = {
		id: 'n1',
		tenantId: 'ten',
		organizationId: 'org',
		type: 'Assignment',
		title: 'Ada assigned you to the Task "Fix totals"',
		message: null,
		entity: 'Task',
		entityId: 't1',
		sentByEmployeeId: 'e1',
		receiverEmployeeId: 'e2',
		isRead: false
	};

	it('files a notification as a NOTIFICATION item of the GAUZY source identified by the notification', () => {
		const input = notificationItemInput(notification as never, 'u2');
		expect(input).toMatchObject({
			tenantId: 'ten',
			organizationId: 'org',
			kind: InboxItemKindEnum.NOTIFICATION,
			source: InboxItemSourceEnum.GAUZY,
			externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
			externalId: 'n1',
			title: 'Ada assigned you to the Task "Fix totals"',
			entity: 'Task',
			entityId: 't1',
			taskId: 't1',
			recipients: [{ userId: 'u2', isRead: false }]
		});
		expect(input?.metadata).toEqual({
			notificationId: 'n1',
			notificationType: 'Assignment',
			sentByEmployeeId: 'e1',
			receiverEmployeeId: 'e2'
		});
	});

	it('keeps the read state and falls back to the type as a title', () => {
		const input = notificationItemInput({ ...notification, title: '  ', isRead: true, entity: 'Comment' } as never, 'u2');
		expect(input?.title).toBe('Assignment');
		expect(input?.taskId).toBeNull();
		expect(input?.recipients).toEqual([{ userId: 'u2', isRead: true }]);
	});

	it('files nothing without an identity, a tenant or a user', () => {
		expect(notificationItemInput({ ...notification, id: '' } as never, 'u2')).toBeNull();
		expect(notificationItemInput({ ...notification, tenantId: undefined } as never, 'u2')).toBeNull();
		expect(notificationItemInput(notification as never, '' as never)).toBeNull();
	});
});

describe('isDedupedNotification / notificationTypeOf', () => {
	it('dedupes a mention on a record, and nothing else', () => {
		expect(isDedupedNotification({ type: EmployeeNotificationTypeEnum.MENTION, entity: BaseEntityEnum.Task, entityId: 't1' })).toBe(true);
		expect(isDedupedNotification({ type: EmployeeNotificationTypeEnum.MENTION, entity: BaseEntityEnum.Task, entityId: undefined } as never)).toBe(false);
		expect(isDedupedNotification({ type: EmployeeNotificationTypeEnum.COMMENT, entity: BaseEntityEnum.Task, entityId: 't1' })).toBe(false);
		expect(isDedupedNotification(null)).toBe(false);
	});

	it('reads the notification type from the metadata the bridge wrote, stored or parsed', () => {
		expect(notificationTypeOf(JSON.stringify({ notificationType: 'Mention' }))).toBe('Mention');
		expect(notificationTypeOf({ notificationType: 'Comment' })).toBe('Comment');
		expect(notificationTypeOf('not json')).toBeNull();
		expect(notificationTypeOf(null)).toBeNull();
	});
});

/** The bridge over doubles: the employee's user, the recipient rows of the window, the items on the record. */
function bridge(options: { recipients?: Array<{ inboxItemId: string }>; items?: Array<{ id: string; externalId: string; metadata: unknown }> } = {}) {
	const employees = { findOne: jest.fn(async () => ({ id: 'e2', userId: 'u2' })) };
	const recipients = { find: jest.fn(async () => options.recipients ?? []) };
	const items = { find: jest.fn(async () => options.items ?? []) };
	const dataSource = {
		getRepository: (entity: { name?: string }) => (entity?.name === 'Employee' ? employees : entity?.name === 'InboxItemRecipient' ? recipients : items)
	} as unknown as DataSource;
	const upsertExternal = jest.fn(async () => ({}));
	const instance = new InboxNotificationBridge(dataSource, { upsertExternal } as unknown as InboxService, new InboxSourceHandlerRegistry());
	return { instance, upsertExternal, recipients, items };
}

describe('InboxNotificationBridge.fileNotification (FR-4)', () => {
	const mention = { id: 'n2', tenantId: 'ten', organizationId: 'org', type: EmployeeNotificationTypeEnum.MENTION, title: 'Ada mentioned you', message: null, entity: 'Task', entityId: 't1', sentByEmployeeId: 'e1', receiverEmployeeId: 'e2', isRead: false };

	it('files a mention whose twin reached the user more than ten minutes ago, or on another record', async () => {
		const { instance, upsertExternal } = bridge({ recipients: [], items: [] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).toHaveBeenCalledTimes(1);
	});

	it('does not file a mention whose twin (same user, record and kind) was filed within ten minutes', async () => {
		const { instance, upsertExternal, items } = bridge({ recipients: [{ inboxItemId: 'i1' }], items: [{ id: 'i1', externalId: 'n1', metadata: JSON.stringify({ notificationType: 'Mention' }) }] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).not.toHaveBeenCalled();
		expect(items.find).toHaveBeenCalledTimes(1);
	});

	it('files a mention beside a recent item of another kind on the record, and any assignment', async () => {
		const { instance, upsertExternal } = bridge({ recipients: [{ inboxItemId: 'i1' }], items: [{ id: 'i1', externalId: 'n1', metadata: JSON.stringify({ notificationType: 'Comment' }) }] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).toHaveBeenCalledTimes(1);

		const assignment = bridge({ recipients: [{ inboxItemId: 'i1' }], items: [{ id: 'i1', externalId: 'n1', metadata: JSON.stringify({ notificationType: 'Assignment' }) }] });
		await assignment.instance.fileNotification({ ...mention, id: 'n3', type: EmployeeNotificationTypeEnum.ASSIGNMENT } as never);
		expect(assignment.upsertExternal).toHaveBeenCalledTimes(1);
		expect(assignment.recipients.find).not.toHaveBeenCalled();
	});
});
