import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	EntitySubscriptionTypeEnum,
	IUser,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { MentionService } from './mention.service';

/**
 * A mention must reach the employee who was mentioned: the notification needs a receiver (the notification
 * list and "mark all as read" filter on `receiverEmployeeId`), and the MENTION subscription belongs to the
 * mentioned employee, not to the author.
 */
describe('MentionService.create', () => {
	const author = createTenantFixture({ user: { employeeId: 'author-employee', name: 'Ada' } as IUser });

	let restore: () => void;
	let eventBus: { publish: jest.Mock };
	let notifications: { publishNotificationEvent: jest.Mock };
	let service: MentionService;

	beforeEach(() => {
		({ restore } = asTenantUser(author));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(TenantAwareCrudService.prototype as any, 'create').mockImplementation(async (entity) => entity);
		eventBus = { publish: jest.fn() };
		notifications = { publishNotificationEvent: jest.fn() };
		service = new MentionService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'mention' } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			eventBus as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			notifications as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const mention = () =>
		service.create({
			entity: BaseEntityEnum.Comment,
			entityId: 'comment-1',
			parentEntityType: BaseEntityEnum.Task,
			parentEntityId: 'task-1',
			mentionedEmployeeId: 'mentioned-employee',
			organizationId: author.organizationId,
			entityName: 'Fix login'
		});

	it('notifies the mentioned employee, sent by the author', async () => {
		await mention();

		expect(notifications.publishNotificationEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				entity: BaseEntityEnum.Task,
				entityId: 'task-1',
				type: EmployeeNotificationTypeEnum.MENTION,
				receiverEmployeeId: 'mentioned-employee',
				sentByEmployeeId: 'author-employee'
			}),
			NotificationActionTypeEnum.Mentioned,
			'Fix login',
			'Ada'
		);
	});

	it('subscribes the mentioned employee to the entity', async () => {
		await mention();

		const [event] = eventBus.publish.mock.calls[0];
		expect(event).toBeInstanceOf(CreateEntitySubscriptionEvent);
		expect(event.input).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			employeeId: 'mentioned-employee',
			type: EntitySubscriptionTypeEnum.MENTION
		});
	});
});

describe('MentionService.updateEntityMentions', () => {
	const author = createTenantFixture({ user: { employeeId: 'author-employee' } as IUser });

	let restore: () => void;
	let eventBus: { publish: jest.Mock };
	let service: MentionService;

	beforeEach(() => {
		({ restore } = asTenantUser(author));
		// No existing mention on the entity
		jest.spyOn(TenantAwareCrudService.prototype, 'find').mockResolvedValue([]);
		eventBus = { publish: jest.fn() };
		service = new MentionService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'mention' } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			eventBus as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publishNotificationEvent: jest.fn() } as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('publishes the mentions added by an edit with the organization of the entity', async () => {
		await service.updateEntityMentions(
			BaseEntityEnum.Comment,
			'comment-1',
			['mentioned-employee'],
			'task-1',
			BaseEntityEnum.Task,
			author.organizationId
		);

		const [event] = eventBus.publish.mock.calls[0];
		expect(event.input).toMatchObject({
			entity: BaseEntityEnum.Comment,
			entityId: 'comment-1',
			mentionedEmployeeId: 'mentioned-employee',
			organizationId: author.organizationId
		});
	});
});

/**
 * An edit is synced against the mentions of every author of the entity. For an employee without
 * CHANGE_SELECTED_EMPLOYEE (EMPLOYEE / MANAGER role) the employee filter narrowed both the read and the delete to
 * the mentions the editor had written: saving content someone else had mentioned an employee in re-published
 * that mention in the editor's name, and removing it from the text left the other author's row in place.
 */
describe('MentionService.updateEntityMentions, on content another employee mentioned someone in', () => {
	// The editor has no CHANGE_SELECTED_EMPLOYEE, the role the employee filter applies to
	const editor = createTenantFixture({ user: { employeeId: 'editor-employee' } as IUser });

	// Stand-in for the per-request store withoutEmployeeFilter() keeps its state in
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	// The mentions another author wrote on the task: one an edit removes, one it keeps
	const stored = () => [
		{
			id: 'mention-1',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			mentionedEmployeeId: 'mentioned-employee',
			employeeId: 'author-employee',
			tenantId: editor.tenantId
		},
		{
			id: 'mention-2',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			mentionedEmployeeId: 'kept-employee',
			employeeId: 'author-employee',
			tenantId: editor.tenantId
		}
	];

	let restore: () => void;
	let eventBus: { publish: jest.Mock };
	let read: jest.SpyInstance;
	let deleted: jest.SpyInstance;
	let service: MentionService;

	beforeEach(() => {
		({ restore } = asTenantUser(editor));
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		// The store answers the rows matching every column the read is scoped by
		read = jest.spyOn(CrudService.prototype, 'find').mockImplementation(async (options) => {
			const where = (options?.where ?? {}) as Record<string, unknown>;
			return stored().filter((row) =>
				Object.entries(where).every(
					([column, value]) => typeof value !== 'string' || row[column as keyof typeof row] === value
				)
			) as never;
		});
		deleted = jest.spyOn(CrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		eventBus = { publish: jest.fn() };
		service = new MentionService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'mention', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			eventBus as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publishNotificationEvent: jest.fn() } as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	const sync = (mentionEmployeeIds: string[]) =>
		requestStorage.run(new Map(), () =>
			service.updateEntityMentions(
				BaseEntityEnum.Task,
				'task-1',
				mentionEmployeeIds,
				undefined,
				undefined,
				editor.organizationId
			)
		);

	it('publishes nothing for a mention another author already wrote', async () => {
		await sync(['mentioned-employee', 'kept-employee']);

		expect(eventBus.publish).not.toHaveBeenCalled();
		expect(deleted).not.toHaveBeenCalled();
	});

	it("deletes only another author's mention the edit removed, within the tenant", async () => {
		await sync(['kept-employee']);

		expect(deleted).toHaveBeenCalledTimes(1);
		const [criteria] = deleted.mock.calls[0];
		expect(criteria).toMatchObject({ entity: BaseEntityEnum.Task, entityId: 'task-1', tenantId: editor.tenantId });
		expect(criteria.mentionedEmployeeId.value).toEqual(['mentioned-employee']);
		expect(criteria).not.toHaveProperty('employeeId');
		expect(eventBus.publish).not.toHaveBeenCalled();
	});

	it('reads the mentions of the entity within the tenant, as full rows', async () => {
		await sync(['mentioned-employee', 'kept-employee']);

		const [options] = read.mock.calls[0];
		expect(options.where).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			tenantId: editor.tenantId
		});
		expect(options.where).not.toHaveProperty('employeeId');
		// A partial load leaves the `persist: false` mirror `mentionedEmployeeId` unset on MikroORM
		expect(options.select).toBeUndefined();
	});

	it('publishes a new mention once the employee filter is back in place', async () => {
		let filterSkipped: boolean | undefined;
		eventBus.publish.mockImplementation(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			filterSkipped = (service as any).getSkipEmployeeFilter();
		});

		await sync(['kept-employee', 'other-employee']);

		expect(eventBus.publish).toHaveBeenCalledTimes(1);
		expect(eventBus.publish.mock.calls[0][0].input).toMatchObject({
			mentionedEmployeeId: 'other-employee',
			employeeId: 'editor-employee'
		});
		expect(filterSkipped).toBe(false);
		expect(deleted).toHaveBeenCalledTimes(1);
	});
});
