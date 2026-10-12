import '../../../core/entities/internal';

import { randomUUID } from 'crypto';
import { FindOperator } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { EmployeeCreateNotificationEventHandler } from './employee-notification.handler';
import {
	EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS,
	EmployeeNotificationService
} from '../../employee-notification.service';
import { EmployeeNotification } from '../../employee-notification.entity';
import { EmployeeCreateNotificationEvent } from '../employee-notification.event';
import { MultiORMEnum } from '../../../core/utils';
import { InMemoryTenantRepository } from '../../../core/testing/tenant-isolation/in-memory-tenant-repository';
import {
	asTenantUser,
	createTenantFixture,
	ITenantFixture
} from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { assertSideEffectFiresExactly } from '../../../core/testing/idempotency/idempotency.assertions';

/**
 * The in-memory repository the tenant-isolation harness provides, plus the two things the redelivery
 * check depends on that a real database does and that fake does not:
 * - on INSERT, the column defaults (`isRead`/`isArchived` false) and the `createdAt` timestamp;
 * - the `Between` operator the lookup uses for its time window. Any other operator fails the test
 *   loudly rather than silently matching nothing.
 */
class NotificationRepository extends InMemoryTenantRepository<EmployeeNotification> {
	constructor() {
		super(new Set(['id', 'tenantId']));
	}

	async save(entity: Partial<EmployeeNotification> | Array<Partial<EmployeeNotification>>) {
		const withDefaults = (row: Partial<EmployeeNotification>) =>
			row.id
				? row
				: {
						...row,
						isRead: row.isRead ?? false,
						isArchived: row.isArchived ?? false,
						createdAt: row.createdAt ?? new Date()
					};
		return super.save(Array.isArray(entity) ? entity.map(withDefaults) : withDefaults(entity));
	}

	async find(options?: { where?: Record<string, unknown> }): Promise<EmployeeNotification[]> {
		const where = Object.entries(options?.where ?? {});
		return this.all().filter((row) => where.every(([key, expected]) => matches(row, key, expected)));
	}
}

function matches(row: EmployeeNotification, key: string, expected: unknown): boolean {
	if (expected instanceof FindOperator) {
		if (expected.type !== 'between') {
			throw new Error(`NotificationRepository: unsupported operator "${expected.type}" on "${key}"`);
		}
		const [from, to] = expected.value as unknown as [Date, Date];
		const actual = row[key] as Date;
		return actual >= from && actual <= to;
	}
	if (expected && typeof expected === 'object' && 'id' in expected) {
		// Relation shorthand added by TenantAwareCrudService, e.g. `{ tenant: { id } }`.
		return row[`${key}Id`] === (expected as { id: unknown }).id;
	}
	return row[key] === expected;
}

/**
 * Covers the redelivery check in `EmployeeNotificationService.create()`.
 *
 * The check is opt-in (`absorbRedelivery`) and `EmployeeCreateNotificationEventHandler` does not enable it:
 * the in-process EventBus never redelivers, so the handler keeps one row per event (pinned below).
 * With the opt-in set, the service absorbs a provable
 * duplicate: an identical notification for the same receiver, still unread and un-archived, created
 * within `EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS`.
 *
 * Everything else must still insert one row per event, as it did before the check existed. An earlier
 * version of the check matched on (receiver, entity, entityId, type) alone, with no window and no
 * read/archived filter, and dropped real notifications:
 * - an employee unassigned and later re-assigned to a task was never notified again (`TaskService`
 *   publishes ASSIGNMENT keyed on the task id);
 * - `MentionService` publishes without `receiverEmployeeId`; TypeORM drops an `undefined` where-key, so
 *   every mention on a task after the first created nothing.
 * The cases below pin both of those down.
 */
describe('EmployeeCreateNotificationEventHandler idempotency', () => {
	let tenant: ITenantFixture;
	let repository: NotificationRepository;
	let service: EmployeeNotificationService;
	let handler: EmployeeCreateNotificationEventHandler;
	let restore: () => void;

	beforeEach(() => {
		tenant = createTenantFixture();
		repository = new NotificationRepository();

		const settingService = {
			findOneByWhereOptions: jest.fn().mockResolvedValue({
				payment: true,
				assignment: true,
				comment: true,
				mention: true,
				message: true,
				invitation: true
			})
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const eventBus = { publish: jest.fn() } as any;

		service = new EmployeeNotificationService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repository as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			settingService,
			eventBus
		);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		handler = new EmployeeCreateNotificationEventHandler(service);

		({ restore } = asTenantUser(tenant));
	});

	afterEach(() => restore());

	/** An ASSIGNMENT notification shaped like the one `TaskService.subscribeNewMembers` publishes. */
	function assignment(overrides: Partial<IEmployeeNotificationCreateInput> = {}): IEmployeeNotificationCreateInput {
		return {
			receiverEmployeeId: randomUUID(),
			sentByEmployeeId: randomUUID(),
			organizationId: tenant.organizationId,
			tenantId: tenant.tenantId,
			type: EmployeeNotificationTypeEnum.ASSIGNMENT,
			entity: BaseEntityEnum.Task,
			entityId: randomUUID(),
			title: 'Jane assigned you to Task "Ship it"',
			...overrides
		};
	}

	// The redelivery check is opt-in and no caller enables it today; exercise it on the service directly.
	const handle = (input: IEmployeeNotificationCreateInput) => service.create(input, { absorbRedelivery: true });

	it('redelivering the SAME event while it is unread returns the existing notification', async () => {
		const input = assignment();
		const results: Array<{ id?: string } | undefined> = [];

		await assertSideEffectFiresExactly({
			run: async () => results.push(await handle(input)),
			sideEffect: jest.spyOn(repository, 'save'),
			expectedCalls: 1,
			times: 2
		});

		expect(repository.all()).toHaveLength(1);
		expect(results[1]?.id).toBe(results[0]?.id);
	});

	it('a later event about a DIFFERENT entity still creates its own notification (not over-deduped)', async () => {
		const input = assignment();

		await handle(input);
		await handle({ ...input, entityId: randomUUID() });

		expect(repository.all()).toHaveLength(2);
	});

	it.each([
		['read', { isRead: true }],
		['archived', { isArchived: true }]
	])('re-assignment after the first notification was %s creates a new notification', async (_, change) => {
		const input = assignment();
		const first = await handle(input);
		Object.assign(
			repository.all().find((row) => row.id === first?.id),
			change
		);

		const second = await handle(input);

		expect(second?.id).not.toBe(first?.id);
		expect(repository.all()).toHaveLength(2);
	});

	it('the same event after the window creates a new notification', async () => {
		const input = assignment();
		const first = await handle(input);
		repository.all().find((row) => row.id === first?.id).createdAt = new Date(
			Date.now() - EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS - 1000
		);

		const second = await handle(input);

		expect(second?.id).not.toBe(first?.id);
		expect(repository.all()).toHaveLength(2);
	});

	it('a second mention on the same task (no receiverEmployeeId) creates a new notification', async () => {
		// Shaped like MentionService's event: the parent task as entity, no receiver and no sender.
		const mention: IEmployeeNotificationCreateInput = {
			organizationId: tenant.organizationId,
			tenantId: tenant.tenantId,
			type: EmployeeNotificationTypeEnum.MENTION,
			entity: BaseEntityEnum.Task,
			entityId: randomUUID(),
			title: 'Jane mentioned you on Task "Ship it"'
		};

		await handle(mention);
		await handle(mention);

		expect(repository.all()).toHaveLength(2);
	});

	it('an event from a different sender or with a different title within the window is not a redelivery', async () => {
		const input = assignment();

		await handle(input);
		await handle({ ...input, sentByEmployeeId: randomUUID() });
		await handle({ ...input, title: 'John assigned you to Task "Ship it"' });
		await handle({ ...input, sentByEmployeeId: undefined });

		expect(repository.all()).toHaveLength(4);
	});

	it('a direct create() (the POST /employee-notification path) inserts every call, as before', async () => {
		const input = assignment();
		const find = jest.spyOn(repository, 'find');

		await service.create(input);
		await service.create(input);

		expect(find).not.toHaveBeenCalled();
		expect(repository.all()).toHaveLength(2);
	});

	it('a failing redelivery lookup still creates the notification', async () => {
		const find = jest.spyOn(repository, 'find').mockRejectedValueOnce(new Error('connection reset'));

		await handle(assignment());

		expect(find).toHaveBeenCalledTimes(1);
		expect(repository.all()).toHaveLength(1);
	});

	it('the event handler inserts one row per event, as on develop (the in-process EventBus never redelivers)', async () => {
		const input = assignment();
		const find = jest.spyOn(repository, 'find');

		await handler.handle(new EmployeeCreateNotificationEvent(input));
		await handler.handle(new EmployeeCreateNotificationEvent(input));

		expect(find).not.toHaveBeenCalled();
		expect(repository.all()).toHaveLength(2);
	});
});
