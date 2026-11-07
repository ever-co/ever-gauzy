import { IInboxItemUpsertInput, InboxItemKindEnum, InboxItemSourceEnum, INBOX_NOTIFICATION_EXTERNAL_SOURCE } from '@gauzy/contracts';
import { InboxNotificationBridge, notificationItemInput } from './inbox-notification.bridge';

/** A platform notification as the bridge receives it. */
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

describe('notificationItemInput', () => {
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

describe('InboxNotificationBridge.fileNotification', () => {
	/** The bridge over a scripted store: the receiver's employee, and the comment a notification names. */
	function bridge(comment: { id: string; entity: string; entityId: string } | null) {
		const employees = { findOne: jest.fn(async () => ({ id: 'e2', userId: 'u2' })) };
		const comments = { findOne: jest.fn(async () => comment) };
		const dataSource = { getRepository: (target: unknown) => (target === 'Comment' ? comments : employees) };
		const inbox = { upsertExternal: jest.fn(async (_input: IInboxItemUpsertInput) => ({})) };
		const registry = { get: () => null, register: jest.fn() };
		return { comments, inbox, service: new InboxNotificationBridge(dataSource as never, inbox as never, registry as never) };
	}

	it('names the task of a comment notification, so the item opens the task at the comment', async () => {
		const { comments, inbox, service } = bridge({ id: 'c1', entity: 'Task', entityId: 't9' });
		await service.fileNotification({ ...notification, type: 'Comment', entity: 'Comment', entityId: 'c1' } as never);
		expect(comments.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1', tenantId: 'ten' } }));
		expect(inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({
				entity: 'Comment',
				entityId: 'c1',
				taskId: 't9',
				metadata: expect.objectContaining({ parentEntity: 'Task', parentEntityId: 't9' })
			})
		);
	});

	it('keeps a comment on another record, and a comment it cannot read, as the notification names it', async () => {
		const other = bridge({ id: 'c1', entity: 'OrganizationProject', entityId: 'p1' });
		await other.service.fileNotification({ ...notification, entity: 'Comment', entityId: 'c1' } as never);
		expect(other.inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({ taskId: null, metadata: expect.objectContaining({ parentEntity: 'OrganizationProject', parentEntityId: 'p1' }) })
		);
		const unread = bridge(null);
		await unread.service.fileNotification({ ...notification, entity: 'Comment', entityId: 'c1' } as never);
		expect(unread.inbox.upsertExternal).toHaveBeenCalledWith(expect.objectContaining({ taskId: null }));
		expect(unread.inbox.upsertExternal.mock.calls[0][0].metadata ?? {}).not.toHaveProperty('parentEntity');
		// A task notification needs no lookup.
		const task = bridge(null);
		await task.service.fileNotification(notification as never);
		expect(task.comments.findOne).not.toHaveBeenCalled();
	});
});
