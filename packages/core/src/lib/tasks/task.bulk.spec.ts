/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { TaskCreateHandler } from './commands/handlers/task-create.handler';
import { TaskController } from './task.controller';
import { TaskResolver } from './task.resolver';

/**
 * `POST /tasks/bulk` and `bulkCreateTasks`: many tasks in one request, each filed exactly as `POST /tasks`
 * and `createTask` file one.
 *
 * The handler under the batch is the real `TaskCreateHandler`, over a scripted store, because the numbering
 * is the part of a task create a batch could get wrong: the handler reads the highest number of the task's
 * project and writes one more, so a batch that applied two items of one project at once would hand both the
 * same number. The executor applies items one after another, and these assertions hold it to that — the
 * numbers a batch hands out are the numbers the same tasks filed one by one would have.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FOREIGN_ORGANIZATION = '00000000-0000-4000-8000-000000000003';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const PROJECT = '00000000-0000-4000-8000-000000000010';

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		},
		denialFor: (permission: PermissionsEnum) => ({
			code: ApiErrorCode.PERMISSION_DENIED,
			status: 403,
			details: { requiredPermission: permission },
			message: 'This caller may not write the requested field.'
		})
	} as unknown as FieldVisibility;
}

/**
 * Both surfaces over the real create handler and a scripted store: the rows it holds, a numbering read
 * of them, and a transaction that keeps nothing when it throws. The store also records how many creates
 * overlap, which is what a race between two items of one batch would look like.
 */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const rows: Array<Record<string, any>> = [];
	let inFlight = 0;
	let mostInFlight = 0;

	const taskService = {
		getMaxTaskNumberByProject: jest.fn(async ({ projectId }: { projectId: string | null }) => {
			inFlight += 1;
			mostInFlight = Math.max(mostInFlight, inFlight);
			// A real read takes a turn of the event loop; a batch that started the next item before this one
			// wrote would read the same highest number here.
			await new Promise((resolve) => setImmediate(resolve));

			return rows.filter((row) => row.projectId === projectId).reduce((max, row) => Math.max(max, row.number), 0);
		}),
		create: jest.fn(async (payload: Record<string, any>) => {
			const row = { ...payload, id: `task-${rows.length + 1}` };
			rows.push(row);
			inFlight -= 1;

			return row;
		})
	};
	const events = { publish: jest.fn() };
	const cqrsEvents = { publish: jest.fn() };
	const activityLog = { logActivity: jest.fn() };
	const handler = new TaskCreateHandler(
		events as never,
		cqrsEvents as never,
		taskService as never,
		{ findOneByIdString: jest.fn().mockResolvedValue({ id: PROJECT, name: 'Gauzy' }) } as never,
		{ findActiveEmployeesByEmployeeIds: jest.fn().mockResolvedValue([]) } as never,
		{ publishMention: jest.fn() } as never,
		activityLog as never,
		{ publishNotificationEvent: jest.fn() } as never
	);
	const commandBus = { execute: jest.fn((command) => handler.execute(command)) };

	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ORG_TASK_ADD]));

	return {
		rows,
		events,
		activityLog,
		taskService,
		mostInFlight: () => mostInFlight,
		controller: new TaskController(taskService as never, commandBus as never, executor),
		resolver: new TaskResolver(taskService as never, commandBus as never, executor)
	};
}

/** A task body as `POST /tasks` takes it. */
const body = (title: string, extra: Record<string, unknown> = {}): never =>
	({
		title,
		status: 'open',
		organizationId: ORGANIZATION,
		projectId: PROJECT,
		...extra
	}) as never;

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', name: 'Ada' } as never);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null as never);
	jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as never);
	// The membership the create route's validator looks up: the caller belongs to one organization.
	jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockImplementation(
		async (organizationId: string) => organizationId === ORGANIZATION
	);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /tasks/bulk — each item is POST /tasks, numbered by its handler', () => {
	it('hands out the numbers the same tasks filed one by one would have, one item at a time', async () => {
		const batch = surfaces();
		const single = surfaces();
		const items = [body('One'), body('Two'), body('Three')];

		const result = await batch.controller.bulk({ items });

		for (const item of items) {
			await single.controller.create(item);
		}

		expect(result).toMatchObject({ total: 3, succeededCount: 3, failedCount: 0 });
		expect(batch.rows.map((row) => [row.title, row.prefix, row.number])).toEqual([
			['One', 'Gau', 1],
			['Two', 'Gau', 2],
			['Three', 'Gau', 3]
		]);
		expect(batch.rows.map((row) => row.number)).toEqual(single.rows.map((row) => row.number));
		// Never two items between the numbering read and the write: the race a batch must not introduce.
		expect(batch.mostInFlight()).toBe(1);
		// The same events the single creates raise, one per task.
		expect(batch.events.publish).toHaveBeenCalledTimes(3);
		expect(batch.events.publish.mock.calls.map(([event]) => event.type)).toEqual([
			BaseEntityEventTypeEnum.CREATED,
			BaseEntityEventTypeEnum.CREATED,
			BaseEntityEventTypeEnum.CREATED
		]);
		expect(batch.activityLog.logActivity).toHaveBeenCalledTimes(3);
	});

	it('numbers each item above the soft-deleted tasks too: they keep their number in the unique index', async () => {
		const batch = surfaces();

		await batch.controller.bulk({ items: [body('One'), body('Two')] });

		expect(batch.taskService.getMaxTaskNumberByProject).toHaveBeenCalledTimes(2);
		for (const call of batch.taskService.getMaxTaskNumberByProject.mock.calls as unknown[][]) {
			expect(call).toEqual([
				expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION, projectId: PROJECT }),
				{ withDeleted: true }
			]);
		}
	});

	it('reports an item naming an organization the caller is not a member of, and numbers the rest contiguously', async () => {
		const { controller, rows } = surfaces();

		const result = await controller.bulk({
			items: [body('One'), body('Elsewhere', { organizationId: FOREIGN_ORGANIZATION }), body('Two')]
		});

		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 1,
				code: ApiErrorCode.VALIDATION_FAILED,
				message: expect.stringContaining('is not associated with the specified organization')
			})
		]);
		expect(rows.map((row) => [row.title, row.number])).toEqual([
			['One', 1],
			['Two', 2]
		]);
	});

	it('refuses an item naming another tenant exactly as the create route does', async () => {
		const { controller, rows } = surfaces();

		const result = await controller.bulk({ items: [body('Mine'), body('Theirs', { tenantId: OTHER_TENANT })] });

		expect(result.failed[0]).toMatchObject({ index: 1, code: ApiErrorCode.VALIDATION_FAILED });
		expect(result.failed[0].message).toContain('not associated with the requested tenant');
		expect(rows.map((row) => row.tenantId)).toEqual([TENANT]);
	});

	it('refuses an atomic batch before writing anything', async () => {
		const { controller, rows, mostInFlight } = surfaces();

		const refusal = await controller
			.bulk({ atomic: true, items: [body('One'), body('Two')] })
			.catch((thrown) => thrown);

		// Each item is TaskCreateCommand, which writes through its own repositories: no transaction could roll
		// the batch back as one, so the route refuses the flag instead of answering as though it were atomic.
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'task' });
		expect(rows).toEqual([]);
		// Not even the numbering read ran: the refusal comes before item 0.
		expect(mostInFlight()).toBe(0);
	});

	it('refuses a batch above its cap before filing anything', async () => {
		const { controller, rows } = surfaces();

		const refusal = await controller
			.bulk({ items: Array.from({ length: 201 }, (_unused, index) => body(`Task ${index}`)) })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect(rows).toEqual([]);
	});

	it('refuses a caller holding neither grant of the create route before the first item', async () => {
		const { controller, rows } = surfaces({ granted: [PermissionsEnum.ORG_TASK_VIEW] });

		const refusal = await controller.bulk({ items: [body('One')] }).catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(rows).toEqual([]);
	});
});

describe('bulkCreateTasks — the same batch over GraphQL, each item `createTask`', () => {
	it('maps each item as `createTask` does and numbers it from the item before it', async () => {
		const { resolver, rows } = surfaces();

		const payload = await resolver.bulkCreateTasks({
			items: [
				{ title: 'One', organizationId: ORGANIZATION, projectId: PROJECT, memberIds: ['employee-1'] },
				{ title: 'Two', organizationId: ORGANIZATION, projectId: PROJECT }
			]
		});

		expect(payload).toMatchObject({ succeeded: 2, failed: 0, total: 2 });
		expect(payload.results.map((result) => result.id)).toEqual(['task-1', 'task-2']);
		expect(rows.map((row) => row.number)).toEqual([1, 2]);
		// The identifiers are handed over as the rows the handler reads, which is what `createTask` does.
		expect(rows[0].members).toEqual([expect.objectContaining({ id: 'employee-1' })]);
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, rows } = surfaces();

		const refusal = await resolver
			.bulkCreateTasks({
				atomic: true,
				items: [{ title: 'One', organizationId: ORGANIZATION, projectId: PROJECT }]
			})
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(rows).toEqual([]);
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, with the cap and the create route’s grants', () => {
		expect(Reflect.getMetadata(PATH_METADATA, TaskController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, TaskController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(TaskController.prototype, 'bulk')).toEqual({
			resource: 'task',
			maxItems: 200,
			permission: Reflect.getMetadata(PERMISSIONS_METADATA, TaskController.prototype.create),
			atomic: false
		});
	});

	it('states the create route’s permission on the route and on the field', () => {
		const create = Reflect.getMetadata(PERMISSIONS_METADATA, TaskController.prototype.create);

		expect(create).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskController.prototype.bulk)).toEqual(create);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TaskResolver.prototype.bulkCreateTasks)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TaskResolver.prototype.createTask)
		);
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TaskController.prototype.bulk);

		expect(route).toEqual({ scope: 'task.bulk', required: false, resourceType: 'task' });
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TaskResolver.prototype.bulkCreateTasks)).toEqual(route);
	});
});
