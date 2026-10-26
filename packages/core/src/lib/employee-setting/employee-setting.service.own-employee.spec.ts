import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { EmployeeSettingDataOperationEnum, IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeSettingService } from './employee-setting.service';

/**
 * Employee settings are their employee's. The CRUD base limits a caller without CHANGE_SELECTED_EMPLOYEE to their own
 * employee, but a caller with no employee record at all (a viewer, a candidate) kept the tenant-wide scope: they read,
 * changed and deleted every employee's settings, and `create` filed a setting under whichever employee the body named
 * (`currentEmployeeId() || input.employeeId`), its de-duplication read finding and overwriting that employee's row.
 */
describe('EmployeeSettingService — a caller with no employee record owns no settings', () => {
	const VICTIM = 'victim-employee';

	let restore: () => void;
	let findOneByWhereOptions: jest.SpyInstance;
	let findOneByOptions: jest.SpyInstance;
	let deleteRows: jest.SpyInstance;
	let create: jest.SpyInstance;
	let service: EmployeeSettingService;

	beforeEach(() => {
		findOneByWhereOptions = jest
			.spyOn(CrudService.prototype, 'findOneByWhereOptions')
			.mockResolvedValue({} as never);
		findOneByOptions = jest
			.spyOn(CrudService.prototype, 'findOneByOptions')
			.mockRejectedValue(new NotFoundException());
		deleteRows = jest.spyOn(CrudService.prototype, 'delete').mockResolvedValue({ raw: [], affected: 0 } as never);
		create = jest.spyOn(CrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		service = new EmployeeSettingService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_setting', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	describe('a viewer: no employee record, no CHANGE_SELECTED_EMPLOYEE', () => {
		beforeEach(() => ({ restore } = asTenantUser(createTenantFixture())));

		it('reads no row: the read is narrowed to an employee set that is empty', async () => {
			await service.findOneByWhereOptions({ employeeId: VICTIM });

			expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: In([]) });
		});

		it('deletes no row', async () => {
			await service.delete('setting-of-the-victim');

			expect(deleteRows.mock.calls[0][0]).toMatchObject({ id: 'setting-of-the-victim', employeeId: In([]) });
		});

		it('may not create or overwrite a setting, for anyone', async () => {
			await expect(service.create({ employeeId: VICTIM, data: {} } as never)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(findOneByOptions).not.toHaveBeenCalled();
			expect(create).not.toHaveBeenCalled();
		});

		it('may not patch a setting that has no employee either: `null === null` read as their own', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			const saved: unknown[] = [];
			const manager = {
				createQueryBuilder: () => {
					const query = {
						where: () => query,
						setLock: () => query,
						getOne: async () => ({ id: 'setting-without-employee', employeeId: null, data: {} })
					};
					return query;
				},
				save: async (_entity: unknown, setting: unknown) => saved.push(setting)
			};
			const patched = new EmployeeSettingService(
				{ manager: { transaction: (work: (m: typeof manager) => unknown) => work(manager) } } as never,
				{} as never
			);

			await expect(
				patched.patchData('setting-without-employee', {
					operations: [{ op: EmployeeSettingDataOperationEnum.SET, path: ['a'], value: 1 }]
				})
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(saved).toHaveLength(0);
		});
	});

	describe('CONTROL: the callers the rule does not touch', () => {
		it('an employee creates their own setting, whatever the body names', async () => {
			({ restore } = asTenantUser(createTenantFixture({ user: { employeeId: 'own-employee' } as IUser })));

			await service.create({ employeeId: VICTIM, data: {} } as never);

			expect(findOneByOptions.mock.calls[0][0].where).toMatchObject({ employeeId: 'own-employee' });
			expect(create.mock.calls[0][0]).toMatchObject({ employeeId: 'own-employee' });
		});

		it('a caller who may act for other employees reaches the employee they name', async () => {
			({ restore } = asTenantUser(createTenantFixture(), {
				permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
			}));

			await service.findOneByWhereOptions({ employeeId: VICTIM });
			await service.create({ employeeId: VICTIM, data: {} } as never);

			expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: VICTIM });
			expect(create.mock.calls[0][0]).toMatchObject({ employeeId: VICTIM });
		});
	});
});
