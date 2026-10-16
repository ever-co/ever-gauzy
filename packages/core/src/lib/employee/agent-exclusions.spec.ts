import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EmployeeKindEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { Employee } from '../core/entities/internal';
import { FindSplitExpenseHandler } from '../expense/queries/handlers/expense.find-split-expense.handler';
import { OrganizationRecurringExpenseFindSplitExpenseHandler } from '../organization-recurring-expense/queries/handlers/organization-recurring-expense.find-split-expense.handler';
import { PayrollRunService } from '../payroll-run/payroll-run.service';
import { StatsService } from '../stats/stats.service';
import { UserService } from '../user/user.service';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeSubscriber } from './employee.subscriber';

/**
 * Agent employees (`employee.kind = 'agent'`, e.g. Ever Works agents) are employees so that they can be
 * assigned, join teams and be mentioned — but they are not people: they are left out of every headcount,
 * statistic, split expense and payroll. People are counted exactly as before.
 */
describe('agent employees are left out of headcounts, statistics, split expenses and payroll', () => {
	const fixture = createTenantFixture();
	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('organization.totalEmployees counts people only', async () => {
		const em = Object.create(EntityManager.prototype) as EntityManager & { countBy: jest.Mock };
		em.countBy = jest.fn().mockResolvedValue(3);
		const subscriber = Object.create(EmployeeSubscriber.prototype);

		await expect(subscriber['countEmployees'](em, 'org-1', 'tenant-1', MultiORMEnum.TypeORM)).resolves.toBe(3);
		expect(em.countBy).toHaveBeenCalledWith(Employee, {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			kind: EmployeeKindEnum.HUMAN
		});
	});

	describe('working employees', () => {
		const filterClauses = (humansOnly?: boolean) => {
			const clauses: string[] = [];
			const web = { andWhere: jest.fn((clause: string) => clauses.push(clause)) };
			const qb = {
				alias: 'employee',
				// A Brackets argument is expanded into the clauses it adds; a plain clause is recorded as is.
				andWhere: jest.fn((condition: string | { whereFactory?: (builder: unknown) => void }) =>
					typeof condition === 'string' ? clauses.push(condition) : condition?.whereFactory?.(web)
				)
			};
			const service = Object.create(EmployeeService.prototype) as EmployeeService;
			service.getFilterQuery(qb as never, 'org-1', null, humansOnly);
			return clauses.join(' ');
		};

		it('the statistics read (humansOnly) leaves agents out', () => {
			expect(filterClauses(true)).toMatch(/"employee"\."kind" = :humanKind/);
		});

		it('the default read (pickers, selectors) is unchanged', () => {
			expect(filterClauses()).not.toMatch(/kind/);
			expect(filterClauses(false)).not.toMatch(/kind/);
		});

		it('the MikroORM branch narrows to people when asked', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			const findAndCount = jest.fn().mockResolvedValue([[], 0]);
			const service = new EmployeeService({ metadata: { tableName: 'employee' } } as never, { findAndCount } as never);

			await service.findWorkingEmployees('org-1', null, false, true);
			expect(findAndCount.mock.calls[0][0]).toMatchObject({ kind: EmployeeKindEnum.HUMAN });

			await service.findWorkingEmployees('org-1', null);
			expect(findAndCount.mock.calls[1][0]).not.toHaveProperty('kind');
		});
	});

	it('GET /employee/count counts people only', async () => {
		const employeeService = { countBy: jest.fn().mockResolvedValue(2) };
		const controller = new EmployeeController(employeeService as never, {} as never, {} as never);

		await expect(controller.getCount({ organizationId: 'org-1' } as never)).resolves.toBe(2);
		expect(employeeService.countBy).toHaveBeenCalledWith({ organizationId: 'org-1', kind: EmployeeKindEnum.HUMAN });
	});

	it('split expenses are divided among people only', async () => {
		const employeeService = {
			findOneByOptions: jest.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
			findAll: jest.fn().mockResolvedValue({ items: [], total: 2 })
		};
		const expenseService = { findAllExpenses: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
		await new FindSplitExpenseHandler(expenseService as never, employeeService as never).execute({
			findInput: { employeeId: 'e-1', relations: [], filterDate: undefined }
		} as never);
		expect(employeeService.findAll).toHaveBeenCalledWith({
			where: { organizationId: 'org-1', kind: EmployeeKindEnum.HUMAN }
		});

		const recurringEmployees = { findAll: jest.fn().mockResolvedValue({ items: [], total: 2 }) };
		const organizationService = { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'org-1' }) };
		const recurringService = { findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
		await new OrganizationRecurringExpenseFindSplitExpenseHandler(
			recurringService as never,
			organizationService as never,
			recurringEmployees as never
		)
			.execute({ orgId: 'org-1', findInput: { year: 2026, month: 9 } } as never)
			.catch(() => undefined);
		expect(recurringEmployees.findAll).toHaveBeenCalledWith({
			where: { organizationId: 'org-1', kind: EmployeeKindEnum.HUMAN }
		});
	});

	it('global stats count people only, employees and users', async () => {
		const employeeService = { count: jest.fn().mockResolvedValue(5) };
		const zero = { count: jest.fn().mockResolvedValue(0) };
		const userService = { getUserStats: jest.fn().mockResolvedValue({ count: 4, lastMonthActiveUsers: 1 }) };
		const service = new StatsService(
			employeeService as never, // employees
			zero as never, // organizations
			zero as never, // teams
			zero as never, // tenants
			userService as never, // users
			zero as never, // tasks
			{ getInvoiceStats: jest.fn().mockResolvedValue({}) } as never,
			{ getPaymentStats: jest.fn().mockResolvedValue({}) } as never,
			{ getOverallTrackedTime: jest.fn().mockResolvedValue(0) } as never
		);
		const stats = await service.getGlobalStats();
		expect(employeeService.count).toHaveBeenCalledWith({ where: { kind: EmployeeKindEnum.HUMAN } });
		expect(stats).toMatchObject({ employees: 5, users: { count: 4, lastMonthActiveUsers: 1 } });
	});

	it('user stats leave out the password-less users behind agent employees', async () => {
		const service = Object.create(UserService.prototype) as UserService;
		jest.spyOn(service, 'count').mockResolvedValue(7);
		jest.spyOn(service, 'countAgentUsers').mockResolvedValue(2);
		jest.spyOn(service, 'getMonthlyActiveUsers').mockResolvedValue(3);

		await expect(service.getUserStats()).resolves.toEqual({ count: 5, lastMonthActiveUsers: 3 });
	});

	describe('payroll never pays an agent employee', () => {
		const payroll = (employee: { id: string; kind: EmployeeKindEnum } | null) => {
			const service = Object.create(PayrollRunService.prototype) as PayrollRunService;
			const findOne = jest.fn().mockResolvedValue(employee);
			Object.defineProperty(service, 'typeOrmRepository', { value: { manager: { findOne } }, configurable: true });
			return { assert: (id: string) => service['assertPayableEmployee'](id, 'tenant-1', 'org-1'), findOne };
		};

		it('accepts a person of the organization', async () => {
			const { assert, findOne } = payroll({ id: 'e-1', kind: EmployeeKindEnum.HUMAN });
			await expect(assert('e-1')).resolves.toBeUndefined();
			expect(findOne).toHaveBeenCalledWith(Employee, expect.objectContaining({
				where: { id: 'e-1', tenantId: 'tenant-1', organizationId: 'org-1' }
			}));
		});

		it('refuses an agent', async () => {
			await expect(payroll({ id: 'e-2', kind: EmployeeKindEnum.AGENT }).assert('e-2')).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('still refuses an employee outside the organization', async () => {
			await expect(payroll(null).assert('e-3')).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
