import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { BaseEntityEnum, EntitySubscriptionTypeEnum, IUser } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
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

	// Stand-in for the per-request store withoutEmployeeFilter() keeps its state in
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	let restore: () => void;
	let created: jest.SpyInstance;
	let lookedUp: jest.SpyInstance;
	let employeeExists: jest.Mock;
	let service: EntitySubscriptionService;

	beforeEach(() => {
		// The author has no CHANGE_SELECTED_EMPLOYEE (EMPLOYEE / MANAGER role), the case where the employee
		// filter and TenantAwareCrudService.create used to swap the named employee for the author
		({ restore } = asTenantUser(author));
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		// No existing subscription
		lookedUp = jest.spyOn(CrudService.prototype, 'findOneByOptions').mockRejectedValue(new Error('not found'));
		created = jest.spyOn(CrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		// The employee lookup used to check that a named employee belongs to the tenant / organization
		employeeExists = jest.fn().mockResolvedValue(true);
		service = new EntitySubscriptionService(
			{
				metadata: { tableName: 'entity_subscription', hasColumnWithPropertyPath: () => true },
				manager: { getRepository: () => ({ existsBy: employeeExists }) }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	const subscribe = (employeeId?: string) =>
		requestStorage.run(new Map(), () =>
			service.create({
				entity: BaseEntityEnum.Task,
				entityId: 'task-1',
				type: EntitySubscriptionTypeEnum.MENTION,
				organizationId: author.organizationId,
				...(employeeId ? { employeeId } : {})
			})
		);

	it('subscribes the employee named in the input, not the current user', async () => {
		await subscribe('mentioned-employee');

		expect(employeeExists).toHaveBeenCalledWith({
			id: 'mentioned-employee',
			tenantId: author.tenantId,
			organizationId: author.organizationId
		});
		// The existing-subscription lookup is for the mentioned employee, not the author
		expect(lookedUp.mock.calls[0][0]).toMatchObject({ where: { employeeId: 'mentioned-employee' } });
		expect(created.mock.calls[0][0]).toMatchObject({
			employeeId: 'mentioned-employee',
			entityId: 'task-1',
			tenantId: author.tenantId
		});
	});

	it('refuses an employee who is not part of the tenant / organization', async () => {
		employeeExists.mockResolvedValue(false);

		await expect(subscribe('foreign-employee')).rejects.toThrow();
		expect(created).not.toHaveBeenCalled();
	});

	it('falls back to the current user when no employee is given, without a lookup', async () => {
		await subscribe();

		expect(employeeExists).not.toHaveBeenCalled();
		expect(created.mock.calls[0][0]).toMatchObject({ employeeId: 'author-employee' });
	});
});
