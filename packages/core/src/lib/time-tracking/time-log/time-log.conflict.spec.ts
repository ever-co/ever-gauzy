/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — the
 * entity graph has to finish initializing before anything applies
 * `@IsEmployeeBelongsToOrganization()`. See the note in `time-log.service.spec.ts`.
 */
import '../../core/entities/internal';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { mockRequestContext, nextMacrotask } from '../testing/recording-query-builder';
import { IGetConflictTimeLogCommand } from './commands';
import { GetTimeLogConflictQueryDTO } from './dto/query';
import { TimeLogController } from './time-log.controller';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const OTHER_TENANT_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const OWN_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const COLLEAGUE_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const LOG_ID = '6b5a4938-2716-4f5e-8d4c-3b2a19087f6e';

const conflictQuery = (overrides: Record<string, unknown> = {}) => ({
	employeeId: COLLEAGUE_EMPLOYEE_ID,
	organizationId: ORGANIZATION_ID,
	startDate: '2000-01-01T00:00:00.000Z',
	endDate: '2100-01-01T00:00:00.000Z',
	...overrides
});

describe('GET /timesheet/time-log/conflict is scoped and validated (GHSA-6qvm-3wg4-26w4, finding 2)', () => {
	describe('GetTimeLogConflictQueryDTO', () => {
		const pipe = new ValidationPipe({ whitelist: true, transform: true });
		const run = (value: unknown) =>
			pipe.transform(value, { type: 'query', metatype: GetTimeLogConflictQueryDTO } as any);

		it('accepts the query the edit-time-log modal actually sends', async () => {
			const result: any = await run({
				ignoreId: [LOG_ID],
				startDate: '2026-01-05T08:00:00.000Z',
				endDate: '2026-01-05T09:00:00.000Z',
				employeeId: OWN_EMPLOYEE_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				relations: ['project', 'task']
			});

			expect(result.employeeId).toBe(OWN_EMPLOYEE_ID);
			expect(result.organizationId).toBe(ORGANIZATION_ID);
			expect(result.ignoreId).toEqual([LOG_ID]);
			expect(result.relations).toEqual(['project', 'task']);
			expect(result.startDate).toEqual(new Date('2026-01-05T08:00:00.000Z'));
			expect(result.endDate).toEqual(new Date('2026-01-05T09:00:00.000Z'));
		});

		it('drops a caller-supplied tenantId rather than carrying it into the query', async () => {
			const result: any = await run(conflictQuery({ tenantId: OTHER_TENANT_ID }));

			expect(result.tenantId).toBeUndefined();
			expect(Object.keys(result)).not.toContain('tenantId');
		});

		it.each([
			['employeeId', conflictQuery({ employeeId: 'not-a-uuid' })],
			['organizationId', conflictQuery({ organizationId: '1' })],
			['startDate', conflictQuery({ startDate: 'whenever' })],
			['endDate', conflictQuery({ endDate: '' })],
			['ignoreId', conflictQuery({ ignoreId: ['nope'] })],
			['a relation outside the allow-list', conflictQuery({ relations: ['employee.user'] })],
			['a relation that is not a relation at all', conflictQuery({ relations: ['tenant'] })],
			['a missing employeeId', conflictQuery({ employeeId: undefined })]
		])('rejects %s', async (_label, value) => {
			await expect(run(value)).rejects.toMatchObject({ status: 400 });
		});

		it('accepts a single (non-array) ignoreId, as other callers send it', async () => {
			const result: any = await run(conflictQuery({ ignoreId: LOG_ID }));
			expect(result.ignoreId).toEqual([LOG_ID]);
		});

		it.each([
			['an empty ignoreId', ''],
			['an ignoreId array with nothing usable in it', ['']]
		])('leaves ignoreId UNDEFINED for %s, never an empty array', async (_label, ignoreId) => {
			// `GetConflictTimeLogHandler` guards the exclusion with `if (input.ignoreId)`, and `[]`
			// is truthy — it would reach `NOT IN (:...id)`, which the drivers expand by joining the
			// values, leaving `NOT IN ()` for the database to reject. `?ignoreId=` used to be a
			// falsy `''` the handler skipped, so an empty array here turns a harmless query into a
			// 500.
			const result: any = await run(conflictQuery({ ignoreId }));

			expect(result.ignoreId).toBeUndefined();
			expect(!!result.ignoreId).toBe(false);
		});
	});

	describe('TimeLogService.getConflictTimeLogs', () => {
		let service: TimeLogService;
		let canManageEmployees: jest.Mock;
		let execute: jest.Mock;

		beforeEach(async () => {
			canManageEmployees = jest.fn();
			execute = jest.fn().mockResolvedValue([]);

			const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
				.useMocker((token) => {
					if (token === ManagedEmployeeService) {
						return { canManageEmployees };
					}
					if (token === CommandBus) {
						return { execute };
					}
					return {};
				})
				.compile();

			service = module.get<TimeLogService>(TimeLogService);
			Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		});

		afterEach(() => jest.restoreAllMocks());

		const actAs = (canChangeSelectedEmployee: boolean, employeeId: string | null = OWN_EMPLOYEE_ID) =>
			mockRequestContext({
				tenantId: TENANT_ID,
				user: { id: USER_ID, employeeId },
				canChangeSelectedEmployee
			});

		// Resolves on a later macrotask, like the repository round-trip behind the real check.
		const resolveLater = (value: boolean) => async () => {
			await nextMacrotask();
			return value;
		};

		it('refuses a plain employee asking for a colleague’s logs', async () => {
			actAs(false);
			canManageEmployees.mockImplementation(resolveLater(false));

			await expect(service.getConflictTimeLogs(conflictQuery() as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			// The point of the fix: the query is never executed at all.
			expect(execute).not.toHaveBeenCalled();
		});

		it('lets a plain employee read their OWN logs without consulting the manager check', async () => {
			actAs(false);

			await service.getConflictTimeLogs(conflictQuery({ employeeId: OWN_EMPLOYEE_ID }) as any);

			expect(canManageEmployees).not.toHaveBeenCalled();
			expect(execute).toHaveBeenCalledTimes(1);
			expect(execute.mock.calls[0][0]).toBeInstanceOf(IGetConflictTimeLogCommand);
			expect(execute.mock.calls[0][0].input).toMatchObject({
				employeeId: OWN_EMPLOYEE_ID,
				tenantId: TENANT_ID
			});
		});

		it('lets a team manager read a managed employee’s logs', async () => {
			actAs(false);
			canManageEmployees.mockImplementation(resolveLater(true));

			await service.getConflictTimeLogs(conflictQuery() as any);

			expect(canManageEmployees).toHaveBeenCalledWith([COLLEAGUE_EMPLOYEE_ID], []);
			expect(execute).toHaveBeenCalledTimes(1);
		});

		it('lets a CHANGE_SELECTED_EMPLOYEE holder through untouched', async () => {
			actAs(true, null);

			await service.getConflictTimeLogs(conflictQuery() as any);

			expect(canManageEmployees).not.toHaveBeenCalled();
			expect(execute.mock.calls[0][0].input).toMatchObject({ employeeId: COLLEAGUE_EMPLOYEE_ID });
		});

		it('refuses a caller that holds neither the permission nor an employee identity', async () => {
			actAs(false, null);
			canManageEmployees.mockImplementation(resolveLater(false));

			await expect(service.getConflictTimeLogs(conflictQuery() as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(execute).not.toHaveBeenCalled();
		});

		it('overrides a caller-supplied tenantId with the request context tenant', async () => {
			actAs(true, null);

			await service.getConflictTimeLogs(conflictQuery({ tenantId: OTHER_TENANT_ID }) as any);

			expect(execute.mock.calls[0][0].input.tenantId).toBe(TENANT_ID);
		});

		it('refuses when there is no tenant on the request context', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			await expect(service.getConflictTimeLogs(conflictQuery() as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(execute).not.toHaveBeenCalled();
		});

		it('CONTROL: the pre-fix route handed the same input straight to the command bus', async () => {
			actAs(false);
			canManageEmployees.mockImplementation(resolveLater(false));

			// `return await this._commandBus.execute(new IGetConflictTimeLogCommand(request));`
			await execute(new IGetConflictTimeLogCommand(conflictQuery() as any));

			expect(execute.mock.calls[0][0].input).toMatchObject({ employeeId: COLLEAGUE_EMPLOYEE_ID });
		});
	});

	describe('TimeLogController.getConflict', () => {
		it('delegates to the authorizing service method', async () => {
			const getConflictTimeLogs = jest.fn().mockResolvedValue([]);
			const module: TestingModule = await Test.createTestingModule({ controllers: [TimeLogController] })
				.useMocker((token) => (token === TimeLogService ? { getConflictTimeLogs } : {}))
				.compile();

			const controller = module.get<TimeLogController>(TimeLogController);
			const request = conflictQuery() as any;

			await controller.getConflict(request);

			expect(getConflictTimeLogs).toHaveBeenCalledWith(request);
		});

		it('binds the route through a whitelisting validation pipe', () => {
			// Without this the route binds the raw `IGetTimeLogConflictInput` interface, and an
			// arbitrary employeeId / organizationId / relation list reaches the query untouched.
			const pipes = Reflect.getMetadata(PIPES_METADATA, TimeLogController.prototype.getConflict) ?? [];
			const pipe = pipes.find((it: unknown) => it instanceof ValidationPipe) as any;

			expect(pipe).toBeDefined();
			expect(pipe.validatorOptions).toMatchObject({ whitelist: true });
			expect(pipe.isTransformEnabled).toBe(true);
		});

		it('requires the TIME_TRACKER family of permissions at the controller level (unchanged)', () => {
			const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogController);
			expect(permissions).toEqual(
				expect.arrayContaining([
					PermissionsEnum.TIME_TRACKER,
					PermissionsEnum.ALL_ORG_EDIT,
					PermissionsEnum.ALL_ORG_VIEW
				])
			);
		});
	});
});
