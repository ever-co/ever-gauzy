import '../entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { TagService } from '../../tags/tag.service';
import { CandidateService } from '../../candidate/candidate.service';
import { OrganizationTeamService } from '../../organization-team/organization-team.service';
import { TaskService } from '../../tasks/task.service';
import { DailyPlanService } from '../../tasks/daily-plan/daily-plan.service';
import { TimeOffRequestService } from '../../time-off-request/time-off-request.service';
import { EmployeeService } from '../../employee/employee.service';
import { EmailTemplateService } from '../../email-template/email-template.service';
import { PipelineService } from '../../pipeline/pipeline.service';
import { RequestApprovalService } from '../../request-approval/request-approval.service';
import { TimerService } from '../../time-tracking/timer/timer.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { ExpenseService } from '../../expense/expense.service';
import { FindSplitExpenseHandler } from '../../expense/queries/handlers/expense.find-split-expense.handler';
import { FindSplitExpenseQuery } from '../../expense/queries/expense.find-split-expense.query';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * The sink-level assertion in `CrudService` only runs on the CRUD read methods. Several services
 * build their own query instead — `createQueryBuilder(...).setFindOptions({ relations })` — and so
 * never reach it, while still applying the client's `relations` verbatim.
 *
 * That matters because every tenant-scoped entity exposes an `organization` relation, so the
 * protected rows are reachable from any of those entities. `GET /api/tags` is the cheapest route of
 * all: its controller declares no permission whatsoever.
 *
 * These cases drive the real services with a fake repository, so a read that must be refused never
 * reaches the ORM.
 */
describe('sensitive-relation enforcement on hand-rolled queries', () => {
	const entity = (name: string, relations: Record<string, () => EntityMetadata> = {}): EntityMetadata =>
		({
			name,
			tableName: name.toLowerCase(),
			findRelationWithPropertyPath: (propertyPath: string) =>
				relations[propertyPath] ? { inverseEntityMetadata: relations[propertyPath]() } : undefined
		} as unknown as EntityMetadata);

	const ORGANIZATION = (): EntityMetadata => entity('Organization', { payments: () => entity('Payment') });
	const withOrganization = (name: string): EntityMetadata =>
		entity(name, { organization: ORGANIZATION, tags: () => entity('Tag', { organization: ORGANIZATION }) });

	let granted: PermissionsEnum[];

	const repositoryFor = (name: string) => {
		const mustNotRun = (method: string) =>
			jest.fn(() => {
				throw new Error(`${name}.${method}: the read must not run when the relation is refused`);
			});
		return {
			metadata: withOrganization(name),
			createQueryBuilder: mustNotRun('createQueryBuilder'),
			findAndCount: jest.fn().mockResolvedValue([[], 0]),
			findOne: mustNotRun('findOne'),
			findOneByOptions: mustNotRun('findOneByOptions')
		};
	};

	/** Every repository-touching method of a fake, so a test can prove none of them ran. */
	const untouched = (repository: ReturnType<typeof repositoryFor>) => {
		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(repository.findAndCount).not.toHaveBeenCalled();
		expect(repository.findOne).not.toHaveBeenCalled();
		expect(repository.findOneByOptions).not.toHaveBeenCalled();
	};

	const PROTECTED = ['organization.payments'];

	beforeEach(() => {
		granted = [];
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('4a1b2c3d-5e6f-4708-8a9b-0c1d2e3f4a5b');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
		// Pin the ORM branch, so a `DB_ORM` set in the environment cannot route a case elsewhere.
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses GET /tags with a protected relation, in the plain array form', async () => {
		const repository = repositoryFor('Tag');
		const service = new TagService(repository as any, {} as any);

		await expect(service.findTags({} as any, ['organization.payments'])).rejects.toThrow(ForbiddenException);
		await expect(service.findTagsByLevel({} as any, ['organization.payments'])).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('refuses the candidate pagination with a protected relation', async () => {
		const repository = repositoryFor('Candidate');
		const service = new CandidateService(repository as any, {} as any);

		await expect(service.pagination({ relations: ['organization.payments'] })).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('refuses the organization-team listing with a protected relation', async () => {
		const repository = repositoryFor('OrganizationTeam');
		const dependencies = [repository, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}] as const;
		const service = new (OrganizationTeamService as any)(...dependencies) as OrganizationTeamService;

		await expect(service.findAll({ relations: ['organization.payments'] } as any)).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('lets an ordinary listing through untouched', async () => {
		const repository = repositoryFor('Tag');
		repository.createQueryBuilder = jest.fn(() => {
			throw new Error('reached the query builder');
		});
		const service = new TagService(repository as any, {} as any);

		// The relation is not in the table, so the assertion must not refuse it. Reaching the query
		// builder is the proof it got past the check.
		await expect(service.findTags({} as any, ['organization'])).rejects.toThrow('reached the query builder');
	});

	it('allows a protected relation to a caller who holds the permission', async () => {
		granted = [PermissionsEnum.ORG_PAYMENT_VIEW];
		const repository = repositoryFor('Tag');
		repository.createQueryBuilder = jest.fn(() => {
			throw new Error('reached the query builder');
		});
		const service = new TagService(repository as any, {} as any);

		await expect(service.findTags({} as any, ['organization.payments'])).rejects.toThrow(
			'reached the query builder'
		);
	});

	describe('the remaining hand-rolled listings', () => {
		it.each([
			['array', PROTECTED],
			['object', { organization: { payments: true } }]
		])('refuses the task listings with a protected relation in %s form', async (_label, relations) => {
			const repository = repositoryFor('Task');
			const service = new (TaskService as any)(repository, {}, {}, {}, {}, {}, {}, {}, {}, {}) as TaskService;
			const options = { where: { organizationId: 'o' }, relations } as any;

			await expect(service.getEmployeeTasks(options)).rejects.toThrow(ForbiddenException);
			await expect(service.getAllTasksByEmployee('e', options)).rejects.toThrow(ForbiddenException);
			await expect(service.findTeamTasks(options)).rejects.toThrow(ForbiddenException);
			await expect(service.findModuleTasks(options)).rejects.toThrow(ForbiddenException);
			await expect(service.getTasksByDateFilters({ relations } as any)).rejects.toThrow(ForbiddenException);

			untouched(repository);
		});

		it('refuses the daily-plan listings with a protected relation', async () => {
			const repository = repositoryFor('DailyPlan');
			const service = new DailyPlanService(repository as any, {} as any, {} as any, {} as any, {} as any);
			const options = { where: { organizationId: 'o' }, relations: PROTECTED } as any;

			await expect(service.getAllPlans(options)).rejects.toThrow(ForbiddenException);
			await expect(service.getTeamDailyPlans(options)).rejects.toThrow(ForbiddenException);

			untouched(repository);
		});

		it('refuses the time-off, employee and email-template listings with a protected relation', async () => {
			const timeOff = repositoryFor('TimeOffRequest');
			const employee = repositoryFor('Employee');
			const emailTemplate = repositoryFor('EmailTemplate');

			await expect(
				new TimeOffRequestService(timeOff as any, {} as any, {} as any).pagination({ relations: PROTECTED })
			).rejects.toThrow(ForbiddenException);
			await expect(
				new EmployeeService(employee as any, {} as any).pagination({ relations: PROTECTED } as any)
			).rejects.toThrow(ForbiddenException);
			await expect(
				new EmailTemplateService(emailTemplate as any, {} as any).findAll({
					where: {},
					relations: { organization: { payments: true } }
				} as any)
			).rejects.toThrow(ForbiddenException);

			[timeOff, employee, emailTemplate].forEach(untouched);
		});

		it('walks the table from the entity actually queried, not from the service entity', async () => {
			// The pipeline service reads DEALS, and the approvals-by-employee read loads the EMPLOYEE.
			const pipeline = repositoryFor('Pipeline');
			const deal = repositoryFor('Deal');
			const approval = repositoryFor('RequestApproval');
			const employee = repositoryFor('Employee');

			await expect(
				new PipelineService(pipeline as any, {} as any, deal as any, {} as any, {} as any).getPipelineDeals(
					'p',
					{},
					PROTECTED
				)
			).rejects.toThrow(ForbiddenException);

			const approvals = new RequestApprovalService(approval as any, {} as any, employee as any, {} as any, {} as any, {} as any);
			await expect(approvals.findRequestApprovalsByEmployeeId('e', PROTECTED, {} as any)).rejects.toThrow(
				ForbiddenException
			);
			await expect(approvals.findAllRequestApprovals({ relations: PROTECTED } as any, {} as any)).rejects.toThrow(
				ForbiddenException
			);

			[pipeline, deal, approval, employee].forEach(untouched);
		});

		it('refuses the timer status with a protected relation on its time logs', async () => {
			const timeLog = repositoryFor('TimeLog');
			const employee = repositoryFor('Employee');
			const service = new TimerService(timeLog as any, {} as any, employee as any, {} as any, {} as any, {} as any);

			await expect(service.getTimerStatus({ relations: PROTECTED } as any)).rejects.toThrow(ForbiddenException);
			await expect(service.getTimerWorkedStatus({ relations: PROTECTED } as any)).rejects.toThrow(
				ForbiddenException
			);

			[timeLog, employee].forEach(untouched);
		});

		it('lets a listing with an unprotected relation reach its query', async () => {
			const repository = repositoryFor('Task');
			const service = new (TaskService as any)(repository, {}, {}, {}, {}, {}, {}, {}, {}, {}) as TaskService;

			// Reaching the query builder is the proof the check let the request through.
			await expect(
				service.findTeamTasks({ where: { organizationId: 'o' }, relations: ['organization', 'members'] } as any)
			).rejects.toThrow(/createQueryBuilder/);
			expect(repository.createQueryBuilder).toHaveBeenCalled();
		});
	});

	describe('listings that delegate to the CRUD read methods', () => {
		// These build their options by hand but hand them to `findAll`, so the sink check covers them.
		beforeEach(() => {
			// No authenticated user: the tenant-aware layer passes the options on without adding a scope.
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
		});

		it('refuses the activity-log listing with a protected relation', async () => {
			const repository = repositoryFor('ActivityLog');
			const service = new ActivityLogService(repository as any, {} as any, {} as any);

			await expect(service.findActivityLogs({ relations: PROTECTED } as any)).rejects.toThrow(ForbiddenException);
			untouched(repository);
		});

		it('refuses the split-expense query with a protected relation', async () => {
			const repository = repositoryFor('Expense');
			const employeeService = {
				findOneByOptions: jest.fn().mockResolvedValue({ organization: { id: 'o' } }),
				findAll: jest.fn().mockResolvedValue({ items: [], total: 0 })
			};
			const handler = new FindSplitExpenseHandler(
				new ExpenseService(repository as any, {} as any),
				employeeService as any
			);

			await expect(
				handler.execute(new FindSplitExpenseQuery({ employeeId: 'e', relations: PROTECTED } as any))
			).rejects.toThrow(ForbiddenException);
			untouched(repository);
		});
	});
});
