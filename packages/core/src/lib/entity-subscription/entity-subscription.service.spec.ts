import '../core/entities/internal';

import { BaseEntityEnum, EntitySubscriptionTypeEnum, IUser } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EntitySubscriptionService } from './entity-subscription.service';

/**
 * Mentions and assignments publish a subscription for the mentioned / assigned employee. `create` used to
 * replace that employee with the current user, so the author got the subscription and the intended employee
 * never did.
 */
describe('EntitySubscriptionService.create', () => {
	const author = createTenantFixture({ user: { employeeId: 'author-employee' } as IUser });

	let restore: () => void;
	let created: jest.SpyInstance;
	let service: EntitySubscriptionService;

	beforeEach(() => {
		({ restore } = asTenantUser(author));
		// No existing subscription
		jest.spyOn(CrudService.prototype, 'findOneByOptions').mockRejectedValue(new Error('not found'));
		created = jest.spyOn(CrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		service = new EntitySubscriptionService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'entity_subscription', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const subscribe = (employeeId?: string) =>
		service.create({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			type: EntitySubscriptionTypeEnum.MENTION,
			organizationId: author.organizationId,
			...(employeeId ? { employeeId } : {})
		});

	it('subscribes the employee named in the input, not the current user', async () => {
		await subscribe('mentioned-employee');

		expect(created.mock.calls[0][0]).toMatchObject({
			employeeId: 'mentioned-employee',
			entityId: 'task-1',
			tenantId: author.tenantId
		});
	});

	it('falls back to the current user when no employee is given', async () => {
		await subscribe();

		expect(created.mock.calls[0][0]).toMatchObject({ employeeId: 'author-employee' });
	});
});
