/**
 * This import must stay FIRST, before any import that pulls a core service or controller: see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../../core/entities/internal';

import { IGetActivitiesInput } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { executedFilters, mockRequestContext, RecordingQueryBuilder } from '../testing/recording-query-builder';
import { ActivityService } from './activity.service';

/**
 * `GET /timesheet/activity` declares `taskIds` and documents it as a filter on specific tasks, but neither ORM
 * branch of the list applied it: a request for the activities of one task was answered with the activities of
 * every task. The arms that send task ids fail before the fix; the others pin the requests it leaves as they were.
 */

const TENANT_ID = 'tenant-1';
const ORGANIZATION_ID = 'organization-1';
const EMPLOYEE_ID = 'employee-1';
const TASK_ID = 'task-1';

/** The request as the REST route hands it over, with its default page. */
const REQUEST = { organizationId: ORGANIZATION_ID, page: 0, limit: 30 } as IGetActivitiesInput;

const TASK_CONDITION = '"activity"."taskId" IN (:...taskIds)';
const EMPLOYEE_CONDITION = '"activity"."employeeId" IN (:...employeeIds)';

/** The TypeORM query builder the list chains on; only the predicates in place when it runs are kept. */
class ActivityQueryBuilder extends RecordingQueryBuilder {
	take(): this {
		return this;
	}
	skip(): this {
		return this;
	}
	leftJoinAndSelect(): this {
		return this;
	}
	orderBy(): this {
		return this;
	}
	addOrderBy(): this {
		return this;
	}
}

function createService(orm: MultiORMEnum) {
	const builder = new ActivityQueryBuilder('activity');
	const typeOrmRepository = { createQueryBuilder: jest.fn(() => builder) };
	const mikroOrmRepository = { find: jest.fn(async () => []) };

	const service = new ActivityService(
		typeOrmRepository as any,
		mikroOrmRepository as any,
		{} as any,
		{} as any,
		{} as any
	);
	Object.defineProperty(service, 'ormType', { value: orm });

	return { service, builder, mikroOrmRepository };
}

/** The parameter a condition binds, or `undefined` when the query ran without that condition. */
function boundValue(conditions: string[], condition: string, value: unknown): unknown {
	const applied = conditions.includes(condition);
	if (!applied) {
		return undefined;
	}
	return value;
}

/** The tasks and employees the TypeORM list filtered on when it ran. */
async function typeOrmListFilters(request: IGetActivitiesInput) {
	const { service, builder } = createService(MultiORMEnum.TypeORM);
	await service.getActivities(request);

	const { conditions, parameters } = executedFilters(builder);
	return {
		taskIds: boundValue(conditions, TASK_CONDITION, parameters.taskIds),
		employeeIds: boundValue(conditions, EMPLOYEE_CONDITION, parameters.employeeIds)
	};
}

/** The `where` the MikroORM list handed the repository. */
async function mikroOrmListWhere(request: IGetActivitiesInput): Promise<Record<string, unknown>> {
	const { service, mikroOrmRepository } = createService(MultiORMEnum.MikroORM);
	await service.getActivities(request);

	const [where] = mikroOrmRepository.find.mock.calls[0] as unknown as [Record<string, unknown>];
	return where;
}

describe('ActivityService.getActivities, the tasks a caller asks for', () => {
	beforeEach(() => {
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: 'user-1', employeeId: EMPLOYEE_ID },
			canChangeSelectedEmployee: false
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists only the activities of the requested tasks on TypeORM, within the scope of the caller', async () => {
		const filters = await typeOrmListFilters({ ...REQUEST, taskIds: [TASK_ID] });

		expect(filters.taskIds).toEqual([TASK_ID]);
		expect(filters.employeeIds).toEqual([EMPLOYEE_ID]);
	});

	it('lists only the activities of the requested tasks on MikroORM, within the scope of the caller', async () => {
		const where = await mikroOrmListWhere({ ...REQUEST, taskIds: [TASK_ID] });

		expect(where.taskId).toEqual({ $in: [TASK_ID] });
		expect(where.employeeId).toEqual({ $in: [EMPLOYEE_ID] });
	});

	it.each([
		['no taskIds', undefined],
		['an empty list', []],
		['an empty id', ['']]
	])('adds no task filter for %s', async (_label, taskIds) => {
		const request = { ...REQUEST, taskIds } as IGetActivitiesInput;

		const filters = await typeOrmListFilters(request);
		const where = await mikroOrmListWhere(request);

		expect(filters.taskIds).toBeUndefined();
		expect(filters.employeeIds).toEqual([EMPLOYEE_ID]);
		expect(where).not.toHaveProperty('taskId');
		expect(where.employeeId).toEqual({ $in: [EMPLOYEE_ID] });
	});
});
