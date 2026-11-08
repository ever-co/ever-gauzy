import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	IInboxItemUpsertInput,
	InboxItemKindEnum,
	InboxItemSourceEnum,
	INBOX_NOTIFICATION_EXTERNAL_SOURCE
} from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxService } from '../inbox.service';
import { InboxNotificationBridge, isDedupedNotification, notificationItemInput, notificationTypeOf, recentTwinCriteriaOf, twinLockNameOf } from './inbox-notification.bridge';

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
	function commentBridge(comment: { id: string; entity: string; entityId: string } | null) {
		const employees = { findOne: jest.fn(async () => ({ id: 'e2', userId: 'u2' })) };
		const comments = { findOne: jest.fn(async () => comment) };
		const dataSource = { getRepository: (target: unknown) => (target === 'Comment' ? comments : employees) };
		const inbox = { upsertExternal: jest.fn(async (_input: IInboxItemUpsertInput) => ({})) };
		const registry = { get: () => null, register: jest.fn() };
		return { comments, inbox, service: new InboxNotificationBridge(dataSource as never, inbox as never, registry as never) };
	}

	it('names the task of a comment notification, so the item opens the task at the comment', async () => {
		const { comments, inbox, service } = commentBridge({ id: 'c1', entity: 'Task', entityId: 't9' });
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
		const other = commentBridge({ id: 'c1', entity: 'OrganizationProject', entityId: 'p1' });
		await other.service.fileNotification({ ...notification, entity: 'Comment', entityId: 'c1' } as never);
		expect(other.inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({ taskId: null, metadata: expect.objectContaining({ parentEntity: 'OrganizationProject', parentEntityId: 'p1' }) })
		);
		const unread = commentBridge(null);
		await unread.service.fileNotification({ ...notification, entity: 'Comment', entityId: 'c1' } as never);
		expect(unread.inbox.upsertExternal).toHaveBeenCalledWith(expect.objectContaining({ taskId: null }));
		expect(unread.inbox.upsertExternal.mock.calls[0][0].metadata ?? {}).not.toHaveProperty('parentEntity');
		// A task notification needs no lookup.
		const task = commentBridge(null);
		await task.service.fileNotification(notification as never);
		expect(task.comments.findOne).not.toHaveBeenCalled();
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
function bridge(options: { twins?: Array<{ metadata: unknown }> } = {}) {
	const employees = { findOne: jest.fn(async () => ({ id: 'e2', userId: 'u2' })) };
	// Named keys, not `Record<string, …>`: the plugin compiles with `noPropertyAccessFromIndexSignature` (TS4111).
	const query = {} as Record<'innerJoin' | 'select' | 'where' | 'andWhere' | 'getRawMany', jest.Mock>;
	query.innerJoin =jest.fn((_entity: unknown, _alias: string, _condition: string) => query);
	query.select = jest.fn((_column: string, _alias: string) => query);
	query.where = jest.fn((_sql: string, _params?: Record<string, unknown>) => query);
	query.andWhere = jest.fn((_sql: string) => query);
	query.getRawMany = jest.fn(async () => options.twins ?? []);
	const recipients = { createQueryBuilder: jest.fn((_alias: string) => query) };
	const dataSource = {
		options: { type: 'sqlite' },
		getRepository: (entity: { name?: string }) => (entity?.name === 'Employee' ? employees : recipients)
	} as unknown as DataSource;
	const upsertExternal = jest.fn(async () => ({}));
	const instance = new InboxNotificationBridge(dataSource, { upsertExternal } as unknown as InboxService, new InboxSourceHandlerRegistry());
	return { instance, upsertExternal, recipients, query };
}

describe('InboxNotificationBridge.fileNotification (FR-4)', () => {
	const mention = { id: 'n2', tenantId: 'ten', organizationId: 'org', type: EmployeeNotificationTypeEnum.MENTION, title: 'Ada mentioned you', message: null, entity: 'Task', entityId: 't1', sentByEmployeeId: 'e1', receiverEmployeeId: 'e2', isRead: false };

	it('files a mention whose twin reached the user more than ten minutes ago, or on another record', async () => {
		const { instance, upsertExternal } = bridge({ twins: [] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).toHaveBeenCalledTimes(1);
	});

	it('does not file a mention whose twin (same user, record and kind) was filed within ten minutes', async () => {
		const { instance, upsertExternal, query } = bridge({ twins: [{ metadata: JSON.stringify({ notificationType: 'Mention' }) }] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).not.toHaveBeenCalled();
		expect(query.getRawMany).toHaveBeenCalledTimes(1);
	});

	it('files a mention beside a recent item of another kind on the record, and any assignment', async () => {
		const { instance, upsertExternal } = bridge({ twins: [{ metadata: JSON.stringify({ notificationType: 'Comment' }) }] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).toHaveBeenCalledTimes(1);

		const assignment = bridge({ twins: [{ metadata: JSON.stringify({ notificationType: 'Assignment' }) }] });
		await assignment.instance.fileNotification({ ...mention, id: 'n3', type: EmployeeNotificationTypeEnum.ASSIGNMENT } as never);
		expect(assignment.upsertExternal).toHaveBeenCalledTimes(1);
		expect(assignment.recipients.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('asks for the twins of the window in one join: the receiver, the record, the kind, not the notification itself', async () => {
		const now = Date.parse('2026-11-07T12:00:00.000Z');
		expect(recentTwinCriteriaOf(mention as never, 'u2', now)).toEqual({
			userId: 'u2',
			tenantId: 'ten',
			since: new Date('2026-11-07T11:50:00.000Z'),
			kind: InboxItemKindEnum.NOTIFICATION,
			source: InboxItemSourceEnum.GAUZY,
			entity: 'Task',
			entityId: 't1',
			externalId: 'n2',
			type: EmployeeNotificationTypeEnum.MENTION
		});

		const { instance, query } = bridge({ twins: [] });
		await instance.fileNotification(mention as never);
		expect(query.innerJoin).toHaveBeenCalledWith(expect.anything(), 'item', expect.stringContaining('item.id = recipient.inboxItemId'));
		expect(query.where.mock.calls[0][0]).toContain('recipient.createdAt >= :since');
		expect(query.where.mock.calls[0][1]).toMatchObject({ userId: 'u2', tenantId: 'ten', entity: 'Task', entityId: 't1', externalId: 'n2' });
		expect(query.andWhere.mock.calls.map((call) => call[0]).join(' ')).toContain('item.externalId != :externalId');
	});

	it('checks and files a mention under one lock per receiver, record and kind; an assignment takes none', async () => {
		const { instance, upsertExternal } = bridge({ twins: [] });
		const run = jest.spyOn(instance['locks'], 'run');
		await instance.fileNotification(mention as never);
		expect(twinLockNameOf(mention as never, 'u2')).toBe('notification-twin:ten:u2:Task:t1:Mention');
		expect(run).toHaveBeenCalledWith('notification-twin:ten:u2:Task:t1:Mention', expect.any(Function));
		expect(upsertExternal).toHaveBeenCalledTimes(1);

		await instance.fileNotification({ ...mention, id: 'n3', type: EmployeeNotificationTypeEnum.ASSIGNMENT } as never);
		expect(run).toHaveBeenCalledTimes(1);
	});
});
