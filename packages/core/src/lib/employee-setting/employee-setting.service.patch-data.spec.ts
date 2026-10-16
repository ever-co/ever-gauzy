jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { isPostgres } from '@gauzy/config';
import { EmployeeSettingDataOperationEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmployeeSettingService } from './employee-setting.service';

const { SET } = EmployeeSettingDataOperationEnum;
const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ME = 'e0000000-0000-4000-8000-000000000001';
const SOMEONE_ELSE = 'e0000000-0000-4000-8000-000000000002';
const SETTING = 'd0000000-0000-4000-8000-000000000001';

/**
 * A stand-in for the database row and its lock: `transaction` runs one callback at a time (what FOR UPDATE
 * does for the rows it holds), and the query builder reads the row as it is when the callback runs.
 */
function fakeTypeOrm(row: Record<string, unknown> | null) {
	const calls = { lock: [] as string[], saved: [] as Record<string, unknown>[] };
	let queue: Promise<unknown> = Promise.resolve();
	const manager = {
		createQueryBuilder: () => {
			const query = {
				where: () => query,
				setLock: (mode: string) => {
					calls.lock.push(mode);
					return query;
				},
				getOne: async () => (row ? { ...row, data: structuredClone(row.data) } : null)
			};
			return query;
		},
		save: async (_entity: unknown, setting: Record<string, unknown>) => {
			calls.saved.push(setting);
			row!.data = setting.data;
			return setting;
		}
	};
	const repository = {
		manager: {
			transaction: (work: (m: typeof manager) => Promise<unknown>) => {
				const run = queue.then(() => work(manager));
				queue = run.catch(() => undefined);
				return run;
			}
		}
	};
	return { repository, calls };
}

describe('EmployeeSettingService.patchData', () => {
	let ormType: jest.SpyInstance;

	beforeEach(() => {
		ormType = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ME);
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(false);
		(isPostgres as jest.Mock).mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	const serviceWith = (repository: unknown, mikro: unknown = {}) => {
		const service = new EmployeeSettingService(repository as never, mikro as never);
		jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => ({ id: SETTING }) as never);
		return service;
	};

	it('changes only the patched keys and saves inside the transaction', async () => {
		const row = { id: SETTING, employeeId: ME, data: { display_filters: { layout: 'list' } } };
		const { repository, calls } = fakeTypeOrm(row);

		await serviceWith(repository).patchData(SETTING, {
			operations: [{ op: SET, path: ['sidebar_preferences', 'views', 'is_pinned'], value: true }]
		});

		expect(calls.saved).toHaveLength(1);
		expect(row.data).toEqual({
			display_filters: { layout: 'list' },
			sidebar_preferences: { views: { is_pinned: true } }
		});
	});

	it('keeps both changes of two concurrent patches of different keys', async () => {
		const row = { id: SETTING, employeeId: ME, data: {} };
		const { repository } = fakeTypeOrm(row);
		const service = serviceWith(repository);

		await Promise.all([
			service.patchData(SETTING, { operations: [{ op: SET, path: ['sidebar_preferences', 'a'], value: 1 }] }),
			service.patchData(SETTING, { operations: [{ op: SET, path: ['home_preferences', 'b'], value: 2 }] })
		]);

		expect(row.data).toEqual({ sidebar_preferences: { a: 1 }, home_preferences: { b: 2 } });
	});

	it('takes a row lock on Postgres and none on the embedded dialect', async () => {
		const sqlite = fakeTypeOrm({ id: SETTING, employeeId: ME, data: {} });
		await serviceWith(sqlite.repository).patchData(SETTING, { operations: [{ op: SET, path: ['a'], value: 1 }] });
		expect(sqlite.calls.lock).toEqual([]);

		(isPostgres as jest.Mock).mockReturnValue(true);
		const postgres = fakeTypeOrm({ id: SETTING, employeeId: ME, data: {} });
		await serviceWith(postgres.repository).patchData(SETTING, { operations: [{ op: SET, path: ['a'], value: 1 }] });
		expect(postgres.calls.lock).toEqual(['pessimistic_write']);
	});

	it('reads data stored as text (the embedded dialect)', async () => {
		const row = { id: SETTING, employeeId: ME, data: JSON.stringify({ kept: true }) };
		const { repository, calls } = fakeTypeOrm(row);

		await serviceWith(repository).patchData(SETTING, { operations: [{ op: SET, path: ['added'], value: 1 }] });

		expect(calls.saved[0].data).toEqual({ kept: true, added: 1 });
	});

	it("refuses another employee's setting, unless the caller may act for other employees", async () => {
		const { repository, calls } = fakeTypeOrm({ id: SETTING, employeeId: SOMEONE_ELSE, data: {} });
		const service = serviceWith(repository);
		const patch = { operations: [{ op: SET, path: ['a'], value: 1 }] };

		await expect(service.patchData(SETTING, patch)).rejects.toBeInstanceOf(ForbiddenException);
		expect(calls.saved).toHaveLength(0);

		(RequestContext.hasAnyPermission as jest.Mock).mockImplementation((permissions: PermissionsEnum[]) =>
			permissions.includes(PermissionsEnum.ALL_ORG_EDIT)
		);
		await expect(service.patchData(SETTING, patch)).resolves.toEqual({ id: SETTING });
	});

	it('answers 404 for a setting outside the tenant', async () => {
		const { repository } = fakeTypeOrm(null);
		await expect(
			serviceWith(repository).patchData(SETTING, { operations: [{ op: SET, path: ['a'], value: 1 }] })
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('locks and flushes through MikroORM when that ORM runs', async () => {
		ormType.mockReturnValue(MultiORMEnum.MikroORM);
		(isPostgres as jest.Mock).mockReturnValue(true);
		const row = { id: SETTING, employeeId: ME, data: { a: 1 } as Record<string, unknown> };
		const findOne = jest.fn(async () => row);
		const flush = jest.fn(async () => undefined);
		const mikro = {
			getEntityManager: () => ({
				transactional: (work: (em: unknown) => Promise<unknown>) => work({ findOne, flush })
			})
		};

		await serviceWith({}, mikro).patchData(SETTING, { operations: [{ op: SET, path: ['b'], value: 2 }] });

		expect(findOne).toHaveBeenCalledWith(
			expect.anything(),
			{ id: SETTING, tenantId: TENANT },
			{
				lockMode: LockMode.PESSIMISTIC_WRITE
			}
		);
		expect(flush).toHaveBeenCalled();
		expect(row.data).toEqual({ a: 1, b: 2 });
	});
});
