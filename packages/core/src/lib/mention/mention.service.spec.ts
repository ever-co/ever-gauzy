import '../core/entities/internal';

import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	EntitySubscriptionTypeEnum,
	IUser,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
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
