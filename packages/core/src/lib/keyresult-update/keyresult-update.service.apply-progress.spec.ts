/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
	IUser,
	KeyResultTypeEnum,
	KeyResultUpdateStatusEnum,
	KpiOperatorEnum,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { Goal } from '../goal/goal.entity';
import { GoalService } from '../goal/goal.service';
import { KeyResult } from '../keyresult/keyresult.entity';
import { KeyResultService } from '../keyresult/keyresult.service';
import { KeyResultUpdate } from './keyresult-update.entity';
import { KeyResultUpdateService } from './keyresult-update.service';

/**
 * Owner decision 2(a) (2026-10-23): `PUT /key-results/:id` and `PUT /goals/:id` need `GOALS_EDIT`
 * (ever-co/ever-gauzy#11323), and the goals page wrote a filed progress update back through both, so an employee's
 * report half-failed. Filing an update (`POST /key-result-updates`, `createKeyResultUpdate`) now applies it on the
 * server: the key result moves to the reported value and the progress that value is, and its goal to the weighted
 * progress of its key results. The progress is the server's, not the request's.
 *
 * A report now moves the key result, so it is filed only by the key result's owner or lead, a `GOALS_EDIT` holder or
 * a tenant administrator, and a key result outside the caller's tenant is a 404 — in both cases with nothing written.
 *
 * The three services run for real against in-memory stores, so every read is the tenant- and organization-scoped one
 * a request gets; the base write they all hand over to is a spy that records which service wrote what, in order.
 */
describe('KeyResultUpdateService — filing a progress update applies it to the key result and its goal', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const OTHER_ORGANIZATION = 'b0000000-0000-4000-8000-000000000002';

	const GOAL = 'e0000000-0000-4000-8000-000000000001';
	const FOREIGN_GOAL = 'e0000000-0000-4000-8000-000000000002';
	const SALES = 'd0000000-0000-4000-8000-000000000001';
	const LAUNCHED = 'd0000000-0000-4000-8000-000000000002';
	const TICKETS = 'd0000000-0000-4000-8000-000000000003';
	const FOREIGN_KEY_RESULT = 'd0000000-0000-4000-8000-000000000004';
	const FILED_UPDATE = 'c0000000-0000-4000-8000-000000000001';

	const OWNER: Partial<IUser> = { id: 'owner-user', employeeId: 'owner-employee' };
	const LEAD: Partial<IUser> = { id: 'lead-user', employeeId: 'lead-employee' };
	const OTHER_EMPLOYEE: Partial<IUser> = { id: 'other-user', employeeId: 'other-employee' };
	const GOALS_EDITOR: Partial<IUser> = { id: 'manager-user', employeeId: 'manager-employee' };
	const ADMIN: Partial<IUser> = { id: 'admin-user' };

	let service: KeyResultUpdateService;
	let keyResultService: KeyResultService;
	let goalService: GoalService;
	let writes: Array<{ by: unknown; entity: Record<string, unknown> }>;

	/** Signs a user in, the way a request does: tenant, token organization, employee, permissions and role. */
	const signIn = (user: Partial<IUser>, role: RolesEnum, permissions: PermissionsEnum[] = []) => {
		asTenantUser(
			{
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				user: { ...user, tenantId: TENANT, lastOrganizationId: ORGANIZATION } as IUser
			},
			{ permissions }
		);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(user.id);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
	};

	/** A report the way the goals page sends it, with a progress of its own that the server must not take. */
	const report = (keyResultId: string, update: number, extra: Record<string, unknown> = {}) =>
		({
			keyResultId,
			owner: 'owner-employee',
			update,
			progress: 99,
			status: KeyResultUpdateStatusEnum.ON_TRACK,
			organizationId: ORGANIZATION,
			...extra
		}) as never;

	const writtenBy = (by: unknown) => writes.filter((write) => write.by === by).map((write) => write.entity);

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const scoped = { tenantId: TENANT, organizationId: ORGANIZATION };
		const keyResults = new InMemoryTenantRepository<KeyResult>(
			new Set(['id', 'tenantId', 'organizationId', 'goalId', 'ownerId', 'leadId'])
		);
		// Sales: 0 → 200, weight 1, owned and led; Launched: done or not, weight 2, at 30% now; Tickets: a KPI that
		// counts down, with no goal.
		keyResults.seed({
			...scoped,
			id: SALES,
			type: KeyResultTypeEnum.NUMERICAL,
			initialValue: 0,
			targetValue: 200,
			update: 0,
			progress: 0,
			status: KeyResultUpdateStatusEnum.NONE,
			weight: '1',
			goalId: GOAL,
			ownerId: OWNER.employeeId,
			leadId: LEAD.employeeId
		} as unknown as KeyResult);
		keyResults.seed({
			...scoped,
			id: LAUNCHED,
			type: KeyResultTypeEnum.TRUE_OR_FALSE,
			update: 0,
			progress: 30,
			status: KeyResultUpdateStatusEnum.NONE,
			weight: '2',
			goalId: GOAL,
			ownerId: OWNER.employeeId,
			leadId: null
		} as unknown as KeyResult);
		keyResults.seed({
			...scoped,
			id: TICKETS,
			type: KeyResultTypeEnum.KPI,
			targetValue: 10,
			update: 20,
			progress: 0,
			status: KeyResultUpdateStatusEnum.NONE,
			weight: '1',
			goalId: null,
			ownerId: OWNER.employeeId,
			leadId: null,
			// What the `kpi` relation the service asks for loads: the key result's own KPI
			kpi: { operator: KpiOperatorEnum.LESSER_THAN_EQUAL_TO }
		} as unknown as KeyResult);
		keyResults.seed({
			id: FOREIGN_KEY_RESULT,
			tenantId: OTHER_TENANT,
			organizationId: OTHER_ORGANIZATION,
			type: KeyResultTypeEnum.NUMERICAL,
			initialValue: 0,
			targetValue: 10,
			weight: '1',
			goalId: FOREIGN_GOAL,
			ownerId: OWNER.employeeId
		} as unknown as KeyResult);

		const goals = new InMemoryTenantRepository<Goal>(new Set(['id', 'tenantId', 'organizationId']));
		goals.seed({ ...scoped, id: GOAL, progress: 10 } as unknown as Goal);
		goals.seed({
			id: FOREIGN_GOAL,
			tenantId: OTHER_TENANT,
			organizationId: OTHER_ORGANIZATION,
			progress: 0
		} as unknown as Goal);

		const updates = new InMemoryTenantRepository<KeyResultUpdate>(
			new Set(['id', 'tenantId', 'organizationId', 'keyResultId'])
		);
		updates.seed({
			...scoped,
			id: FILED_UPDATE,
			keyResultId: SALES,
			owner: OWNER.employeeId,
			update: 40,
			progress: 20,
			status: KeyResultUpdateStatusEnum.ON_TRACK,
			createdByUserId: OWNER.id
		} as unknown as KeyResultUpdate);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		keyResultService = new KeyResultService(keyResults as any, {} as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		goalService = new GoalService(goals as any, {} as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new KeyResultUpdateService(updates as any, {} as any, keyResultService, goalService);

		writes = [];
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async function (
			this: unknown,
			entity
		) {
			writes.push({ by: this, entity: { ...(entity as Record<string, unknown>) } });
			return { ...(entity as object) } as never;
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('moves the key result to the reported value and its progress, then its goal, then files the row', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		const filed = await service.create(report(SALES, 100));

		// 100 of 0 → 200 is 50%, whatever the request said
		expect(writtenBy(keyResultService)).toEqual([
			{ id: SALES, update: 100, progress: 50, status: KeyResultUpdateStatusEnum.ON_TRACK }
		]);
		// (50 × 1 + 30 × 2) / 3 = 36.7: the moved key result at its new progress, the other at the one it has
		expect(writtenBy(goalService)).toEqual([{ id: GOAL, progress: 37 }]);
		expect(writtenBy(service)).toEqual([
			{
				update: 100,
				progress: 50,
				status: KeyResultUpdateStatusEnum.ON_TRACK,
				owner: OWNER.employeeId,
				keyResultId: SALES,
				organizationId: ORGANIZATION
			}
		]);
		expect(writes.map((write) => write.by)).toEqual([keyResultService, goalService, service]);
		expect(filed).toMatchObject({ keyResultId: SALES, progress: 50 });
	});

	it('lets the lead of the key result report on it', async () => {
		signIn(LEAD, RolesEnum.EMPLOYEE);

		await service.create(report(SALES, 50));

		expect(writtenBy(keyResultService)).toEqual([expect.objectContaining({ id: SALES, progress: 25 })]);
	});

	it('lets a GOALS_EDIT holder report on a key result they neither own nor lead', async () => {
		signIn(GOALS_EDITOR, RolesEnum.MANAGER, [PermissionsEnum.GOALS_EDIT]);

		await service.create(report(SALES, 200));

		expect(writtenBy(keyResultService)).toEqual([expect.objectContaining({ id: SALES, progress: 100 })]);
	});

	it('lets a tenant administrator report on any key result of the tenant', async () => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await service.create(report(SALES, 200));

		expect(writtenBy(keyResultService)).toEqual([expect.objectContaining({ id: SALES, progress: 100 })]);
		expect(writtenBy(goalService)).toEqual([{ id: GOAL, progress: 53 }]);
	});

	it('refuses an employee who neither owns nor leads the key result, and writes nothing', async () => {
		signIn(OTHER_EMPLOYEE, RolesEnum.EMPLOYEE);

		await expect(service.create(report(SALES, 100))).rejects.toBeInstanceOf(ForbiddenException);
		expect(writes).toEqual([]);
	});

	it('answers a key result of another tenant with 404, for a tenant admin too, and writes nothing', async () => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(service.create(report(FOREIGN_KEY_RESULT, 5))).rejects.toBeInstanceOf(NotFoundException);
		expect(writes).toEqual([]);
	});

	it('refuses a report that names no key result, and writes nothing', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		await expect(service.create(report(undefined, 5))).rejects.toBeInstanceOf(BadRequestException);
		expect(writes).toEqual([]);
	});

	it('takes the key result from the nested relation when only that is sent', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		await service.create(report(undefined, 1, { keyResult: { id: LAUNCHED } }));

		expect(writtenBy(keyResultService)).toEqual([
			expect.objectContaining({ id: LAUNCHED, update: 1, progress: 100 })
		]);
	});

	it('stores a True/False report as done or not done', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		await service.create(report(LAUNCHED, 1));

		expect(writtenBy(keyResultService)).toEqual([
			{ id: LAUNCHED, update: 1, progress: 100, status: KeyResultUpdateStatusEnum.ON_TRACK }
		]);
		// (0 × 1 + 100 × 2) / 3
		expect(writtenBy(goalService)).toEqual([{ id: GOAL, progress: 67 }]);
	});

	it('judges a KPI key result by its own KPI’s operator, and leaves goals alone when it has none', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		await service.create(report(TICKETS, 8));
		await service.create(report(TICKETS, 12));

		expect(writtenBy(keyResultService)).toEqual([
			{ id: TICKETS, update: 8, progress: 100, status: KeyResultUpdateStatusEnum.ON_TRACK },
			{ id: TICKETS, update: 12, progress: 0, status: KeyResultUpdateStatusEnum.ON_TRACK }
		]);
		expect(writtenBy(goalService)).toEqual([]);
	});

	it('changes only the history row when a filed update is edited', async () => {
		signIn(OWNER, RolesEnum.EMPLOYEE);

		await service.create({ id: FILED_UPDATE, update: 60 } as never);

		expect(writtenBy(service)).toEqual([{ id: FILED_UPDATE, update: 60 }]);
		expect(writtenBy(keyResultService)).toEqual([]);
		expect(writtenBy(goalService)).toEqual([]);
	});
});
