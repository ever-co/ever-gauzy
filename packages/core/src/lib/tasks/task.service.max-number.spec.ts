import '../core/entities/internal';

import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TaskService } from './task.service';

/**
 * A soft-deleted task keeps its number in the per-project `taskNumber` unique index, but the highest number
 * was read from the live tasks only: when the project's top task was soft-deleted, the next create (or move)
 * stored that same number again and failed on the unique index. Callers that store `max + 1` now ask with
 * `withDeleted`; the max-number read routes keep counting live tasks only. The repositories are scripted:
 * these specs check what reaches the store, not a real database.
 */
const TENANT = '63000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '63000000-0000-4000-8000-0000000000a1';
const PROJECT = '63000000-0000-4000-8000-0000000000b1';
const options = { tenantId: TENANT, organizationId: ORGANIZATION, projectId: PROJECT };

function surfaces(maxTaskNumber: string, mikroRows: Array<{ number: number | null }>) {
	const query = {
		alias: 'task',
		select: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		withDeleted: jest.fn().mockReturnThis(),
		getRawOne: jest.fn().mockResolvedValue({ maxTaskNumber })
	};
	const typeOrmRepository = { metadata: { tableName: 'task' }, createQueryBuilder: jest.fn(() => query) };
	const mikroOrmRepository = { find: jest.fn().mockResolvedValue(mikroRows) };
	const service: TaskService = Object.create(TaskService.prototype);
	Object.defineProperty(service, 'typeOrmRepository', { value: typeOrmRepository });
	Object.defineProperty(service, 'mikroOrmRepository', { value: mikroOrmRepository });
	return { service, query, mikroOrmRepository };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('TaskService.getMaxTaskNumberByProject (TypeORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	it('counts live tasks only by default (the max-number read routes)', async () => {
		const { service, query } = surfaces('7', []);

		expect(await service.getMaxTaskNumberByProject(options)).toBe(7);
		expect(query.withDeleted).not.toHaveBeenCalled();
	});

	it('counts soft-deleted tasks too when asked, before the query runs', async () => {
		// The project's highest number (9) belongs to a soft-deleted task
		const { service, query } = surfaces('9', []);

		expect(await service.getMaxTaskNumberByProject(options, { withDeleted: true })).toBe(9);
		expect(query.withDeleted).toHaveBeenCalledTimes(1);
		expect(query.withDeleted.mock.invocationCallOrder[0]).toBeLessThan(
			query.getRawOne.mock.invocationCallOrder[0]
		);
	});
});

describe('TaskService.getMaxTaskNumberByProject (MikroORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	it('counts live tasks only by default (the max-number read routes)', async () => {
		const { service, mikroOrmRepository } = surfaces('0', [{ number: 7 }]);

		expect(await service.getMaxTaskNumberByProject(options)).toBe(7);
		const [where, findOptions] = mikroOrmRepository.find.mock.calls[0];
		expect(where).toEqual({ tenantId: TENANT, organizationId: ORGANIZATION, projectId: PROJECT });
		expect(findOptions.filters).toBeUndefined();
	});

	it('lifts the soft-delete filter when asked, and skips rows without a number', async () => {
		const { service, mikroOrmRepository } = surfaces('0', [{ number: 9 }]);

		expect(await service.getMaxTaskNumberByProject(options, { withDeleted: true })).toBe(9);
		const [where, findOptions] = mikroOrmRepository.find.mock.calls[0];
		// Old soft-deleted rows may have no number, and PostgreSQL sorts NULL first in DESC order
		expect(where).toEqual({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			projectId: PROJECT,
			number: { $ne: null }
		});
		expect(findOptions).toMatchObject({ orderBy: { number: 'DESC' }, limit: 1 });
		expect(findOptions.filters).toEqual({ [SOFT_DELETABLE_FILTER]: false });
	});

	it('reads the tasks without a project when none is given', async () => {
		const { service, mikroOrmRepository } = surfaces('0', []);

		expect(
			await service.getMaxTaskNumberByProject({ ...options, projectId: null }, { withDeleted: true })
		).toBe(0);
		expect(mikroOrmRepository.find.mock.calls[0][0]).toMatchObject({ projectId: null });
	});
});
