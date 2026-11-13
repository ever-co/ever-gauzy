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
import {
	InboxNotificationBridge,
	isDedupedNotification,
	notificationIdsOf,
	notificationItemInput,
	notificationTypeOf,
	recentTwinCriteriaOf,
	twinLockNameOf,
	twinNotificationIdsOf
} from './inbox-notification.bridge';

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

	it('files a notification already archived through the notification API archived (a late filing by the sweep)', () => {
		expect(notificationItemInput({ ...notification, isArchived: true } as never, 'u2')?.recipients).toEqual([
			{ userId: 'u2', isRead: false, isArchived: true }
		]);
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
		// No item is filed for the notification yet.
		const items = { findOne: jest.fn(async () => null) };
		const dataSource = {
			getRepository: (target: unknown) =>
				target === 'Comment' ? comments : (target as { name?: string })?.name === 'InboxItem' ? items : employees
		};
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

	it('files a comment on a followed page as an entry about the comment, the page in its metadata, with no lookup', async () => {
		const { comments, inbox, service } = commentBridge(null);
		await service.fileNotification({ ...notification, type: 'Comment', entity: 'Document', entityId: 'page-1', commentId: 'c7' } as never);
		expect(comments.findOne).not.toHaveBeenCalled();
		expect(inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({
				entity: 'Comment',
				entityId: 'c7',
				taskId: null,
				metadata: expect.objectContaining({ commentId: 'c7', parentEntity: 'Document', parentEntityId: 'page-1', notificationType: 'Comment' })
			})
		);
	});
});

describe('notificationItemInput with a comment', () => {
	it('opens the task at the comment for a comment on a followed task', () => {
		const input = notificationItemInput({ ...notification, type: 'Comment', entity: 'Task', entityId: 't1', commentId: 'c1' } as never, 'u2');
		expect(input).toMatchObject({ entity: 'Comment', entityId: 'c1', taskId: 't1', metadata: { parentEntity: 'Task', parentEntityId: 't1', commentId: 'c1' } });
	});

	it('keeps a mention on its record (its twins are found by it), and a notification without a comment as before', () => {
		const mention = notificationItemInput({ ...notification, type: 'Mention', entity: 'Document', entityId: 'page-1', commentId: 'c1' } as never, 'u2');
		expect(mention).toMatchObject({ entity: 'Document', entityId: 'page-1' });
		const plain = notificationItemInput({ ...notification, type: 'Comment', entity: 'Document', entityId: 'page-1' } as never, 'u2');
		expect(plain).toMatchObject({ entity: 'Document', entityId: 'page-1', taskId: null });
		expect(plain?.metadata).not.toHaveProperty('commentId');
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

	it('reads the folded twins an item stands for, and every notification row it stands for', () => {
		const metadata = JSON.stringify({ notificationType: 'Mention', twinNotificationIds: ['n2', 'n3', 7, ''] });
		expect(twinNotificationIdsOf(metadata)).toEqual(['n2', 'n3']);
		expect(twinNotificationIdsOf({ twinNotificationIds: 'n2' })).toEqual([]);
		expect(twinNotificationIdsOf('not json')).toEqual([]);
		expect(notificationIdsOf({ externalId: 'n1', metadata })).toEqual(['n1', 'n2', 'n3']);
		expect(notificationIdsOf({ externalId: 'n1', metadata: { twinNotificationIds: ['n1'] } })).toEqual(['n1']);
		expect(notificationIdsOf({ externalId: null, metadata: null })).toEqual([]);
	});
});

/**
 * The bridge over doubles: the employee's user, the recipient rows of the window, the items on the record (none filed
 * for the notification itself; `twinItem` is what the twin's id reads as), the notification rows.
 */
function bridge(
	options: {
		twins?: Array<{ id?: string; metadata: unknown }>;
		twinItem?: Record<string, unknown> | null;
		twinRecipient?: Record<string, unknown> | null;
	} = {}
) {
	const employees = { findOne: jest.fn(async () => ({ id: 'e2', userId: 'u2' })) };
	// Named keys, not `Record<string, …>`: the plugin compiles with `noPropertyAccessFromIndexSignature` (TS4111).
	const query = {} as Record<'innerJoin' | 'select' | 'addSelect' | 'where' | 'andWhere' | 'orderBy' | 'getRawMany', jest.Mock>;
	query.innerJoin =jest.fn((_entity: unknown, _alias: string, _condition: string) => query);
	query.select = jest.fn((_column: string, _alias: string) => query);
	query.addSelect = jest.fn((_column: string, _alias: string) => query);
	query.where = jest.fn((_sql: string, _params?: Record<string, unknown>) => query);
	query.andWhere = jest.fn((_sql: string) => query);
	query.orderBy = jest.fn((_column: string, _order: string) => query);
	query.getRawMany = jest.fn(async () => options.twins ?? []);
	const recipients = {
		createQueryBuilder: jest.fn((_alias: string) => query),
		findOne: jest.fn(async () => options.twinRecipient ?? null)
	};
	const items = {
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (where['id'] ? (options.twinItem ?? null) : null)),
		update: jest.fn(async (_criteria: unknown, _values: unknown) => ({}))
	};
	const notifications = {
		find: jest.fn(async (_options: unknown) => [] as Array<Record<string, unknown>>),
		update: jest.fn(async (_criteria: unknown, _values: unknown) => ({}))
	};
	const dataSource = {
		options: { type: 'sqlite' },
		getRepository: (entity: { name?: string }) =>
			entity?.name === 'Employee'
				? employees
				: entity?.name === 'InboxItem'
					? items
					: entity?.name === 'EmployeeNotification'
						? notifications
						: recipients
	} as unknown as DataSource;
	const upsertExternal = jest.fn(async () => ({}));
	const instance = new InboxNotificationBridge(dataSource, { upsertExternal } as unknown as InboxService, new InboxSourceHandlerRegistry());
	return { instance, upsertExternal, recipients, query, items, notifications };
}

describe('InboxNotificationBridge.fileNotification (FR-4)', () => {
	const mention = { id: 'n2', tenantId: 'ten', organizationId: 'org', type: EmployeeNotificationTypeEnum.MENTION, title: 'Ada mentioned you', message: null, entity: 'Task', entityId: 't1', sentByEmployeeId: 'e1', receiverEmployeeId: 'e2', isRead: false };

	it('files a mention whose twin reached the user more than ten minutes ago, or on another record', async () => {
		const { instance, upsertExternal } = bridge({ twins: [] });
		await instance.fileNotification(mention as never);
		expect(upsertExternal).toHaveBeenCalledTimes(1);
	});

	it('does not file a mention whose twin (same user, record and kind) was filed within ten minutes: it records it there', async () => {
		const metadata = JSON.stringify({ notificationType: 'Mention', twinNotificationIds: ['n0'] });
		const readAt = new Date('2026-11-07T12:00:00.000Z');
		const { instance, upsertExternal, query, items, notifications } = bridge({
			twins: [{ id: 'i1', metadata }],
			twinItem: { id: 'i1', tenantId: 'ten', externalId: 'n1', metadata },
			twinRecipient: { isRead: true, readAt, isArchived: false }
		});
		notifications.find.mockResolvedValueOnce([{ id: 'n2', isRead: false, isArchived: false }]);
		expect(await instance.settleNotification(mention as never)).toBe('folded');
		expect(upsertExternal).not.toHaveBeenCalled();
		expect(query.getRawMany).toHaveBeenCalledTimes(1);
		// The many-to-one record: the twin's id joins the ones the entry already stands for.
		const [criteria, written] = items.update.mock.calls[0] as unknown as [unknown, { metadata: string }];
		expect(criteria).toEqual({ id: 'i1' });
		expect(JSON.parse(written.metadata)).toEqual({ notificationType: 'Mention', twinNotificationIds: ['n0', 'n2'] });
		// The folded row takes the entry's state: the entry was read, so the row is too.
		expect(notifications.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ isRead: true, readAt }));
	});

	it('leaves a mention already recorded on its twin alone', async () => {
		const metadata = JSON.stringify({ notificationType: 'Mention', twinNotificationIds: ['n2'] });
		const { instance, upsertExternal, items } = bridge({ twins: [{ id: 'i1', metadata }] });
		expect(await instance.settleNotification(mention as never)).toBe('present');
		expect(upsertExternal).not.toHaveBeenCalled();
		expect(items.update).not.toHaveBeenCalled();
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
			until: new Date('2026-11-07T12:10:00.000Z'),
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

describe('InboxNotificationBridge.onStateChange (the rows an entry stands for)', () => {
	it("mirrors a state change to the item's own notification and to every twin folded into it, read afresh", async () => {
		// The twins as stored now (a fold may have landed after the caller read the item).
		const stored = { id: 'i1', tenantId: 'ten', externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE, externalId: 'n1', metadata: JSON.stringify({ twinNotificationIds: ['n2', 'n3'] }) };
		const { instance, notifications } = bridge({ twinItem: stored });
		notifications.find.mockResolvedValueOnce([
			{ id: 'n1', isRead: false, isArchived: false },
			{ id: 'n2', isRead: false, isArchived: false },
			{ id: 'n3', isRead: true, isArchived: false }
		]);
		const readAt = new Date('2026-11-07T12:00:00.000Z');
		const item = { id: 'i1', externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE, externalId: 'n1', tenantId: 'ten', metadata: { twinNotificationIds: ['n2'] } };
		await instance.onStateChange(item as never, { userId: 'u2', readAt } as never, { isRead: true });

		const [{ where }] = notifications.find.mock.calls[0] as unknown as [{ where: { id: { value: string[] }; tenantId: string } }];
		expect(where.id.value).toEqual(['n1', 'n2', 'n3']);
		expect(where.tenantId).toBe('ten');
		// Only the rows whose state differs are written.
		const [criteria, patch] = notifications.update.mock.calls[0] as unknown as [{ id: { value: string[] } }, Record<string, unknown>];
		expect(criteria.id.value).toEqual(['n1', 'n2']);
		expect(patch).toEqual({ isRead: true, readAt });
	});

	it('mirrors nothing for an item of another source, or with nothing stated', async () => {
		const { instance, notifications } = bridge();
		await instance.onStateChange({ externalSource: 'ever-works', externalId: 'x', tenantId: 'ten' } as never, {} as never, { isRead: true });
		await instance.onStateChange({ externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE, externalId: 'n1', tenantId: 'ten' } as never, {} as never, {});
		expect(notifications.find).not.toHaveBeenCalled();
	});
});
