// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

// Plan dates are stored in UTC on SQLite and in the process's local time elsewhere (daily-plan-stored-day.spec.ts
// covers both): the UTC dates below hold whatever database and time zone the suite runs with.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isSqlite: () => true,
	isBetterSqlite3: () => false
}));

import { UnprocessableEntityException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import * as moment from 'moment';
import { IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { DailyPlan, OrganizationTeam } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { DAILY_PLAN_REQUIRED, TASK_NOT_PLANNED, planDatesAroundToday } from './timer-plan-rule';
import { TimerService } from './timer.service';

/**
 * A team can require its members to plan their day before they track time. The API stored the setting and never
 * checked it, so the Ever Teams mobile app and older web tabs started the timer without a plan. An Ever Teams start
 * is refused now when the team requires a plan and none is found around today, or the task is in none of them.
 */

interface PlanRow {
	organizationTeamId: string;
	employeeId?: string;
	organizationId?: string;
	tenantId?: string;
	date: Date;
	tasks: { id: string }[];
	isActive?: boolean | null;
	isArchived?: boolean | null;
}

/** Applies a TypeORM condition as the database would: a plain value, `Between`, `Or`, `IsNull` and `Equal`. */
function matchesCondition(value: unknown, condition: unknown): boolean {
	if (!(condition instanceof FindOperator)) {
		return value === condition;
	}
	switch (condition.type) {
		case 'between': {
			const [from, to] = condition.value as unknown as Date[];
			const time = new Date(value as Date).getTime();
			return time >= from.getTime() && time <= to.getTime();
		}
		case 'or': {
			const alternatives = condition.value as unknown as unknown[];
			return alternatives.some((alternative) => matchesCondition(value, alternative));
		}
		case 'isNull':
			return value === null || value === undefined;
		case 'equal':
			return value === condition.value;
		default:
			throw new Error(`Unexpected TypeORM operator "${condition.type}"`);
	}
}

function utcDay(offsetDays: number): Date {
	return moment.utc().startOf('day').add(offsetDays, 'days').toDate();
}

describe('TimerService.startTimer when the team requires a daily plan', () => {
	const TEAM = 'team-support';
	const OTHER_TEAM = 'team-sales';
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const employee = {
		id: 'employee-1',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: true
	};

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let findOne: jest.Mock;
	let find: jest.Mock;
	let stopPreviousRunningTimers: jest.Mock;
	let requirePlanToTrack: boolean;
	let storedTeam: Record<string, unknown>;
	let plans: PlanRow[];

	const start = (source: TimeLogSourceEnum, taskId = 'task-1') =>
		service.startTimer({ source, organizationTeamId: TEAM, taskId });

	const plansMatching = (where: Record<string, unknown>) =>
		plans.filter((plan) => {
			const stored: Record<string, unknown> = {
				employeeId: 'employee-1',
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId,
				...plan,
				isActive: plan.isActive ?? null,
				isArchived: plan.isArchived ?? null
			};
			return Object.entries(where).every(([key, condition]) => matchesCondition(stored[key], condition));
		});

	const createdLog = () => execute.mock.calls.some(([command]) => command instanceof TimeLogCreateCommand);

	const refusalCodeOf = async (attempt: Promise<unknown>) => {
		const error = await attempt.then(
			() => null,
			(thrown: unknown) => thrown
		);
		expect(error).toBeInstanceOf(UnprocessableEntityException);
		return ((error as UnprocessableEntityException).getResponse() as { code?: string }).code;
	};

	beforeEach(() => {
		// One frozen "now" for the plan dates and the rule, so a run across UTC midnight cannot split them
		jest.useFakeTimers({
			now: new Date('2026-11-05T12:00:00.000Z'),
			doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']
		});
		({ restore } = asTenantUser(fixture));
		requirePlanToTrack = true;
		storedTeam = { id: TEAM, organizationId: fixture.organizationId, tenantId: fixture.tenantId };
		plans = [];
		findOne = jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
			if (entity !== OrganizationTeam) {
				return null;
			}
			const isStoredTeamAsked = Object.entries(where).every(([key, value]) => storedTeam[key] === value);
			if (!isStoredTeamAsked) {
				return null;
			}
			return { id: TEAM, requirePlanToTrack };
		});
		find = jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
			if (entity !== DailyPlan) {
				return [];
			}
			return plansMatching(where);
		});
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ manager: { findOne, find } } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		stopPreviousRunningTimers = jest.fn(async () => undefined);
		Object.assign(service, { stopPreviousRunningTimers });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'refuses a %s start without a plan, and leaves the running timer alone',
		async (source) => {
			expect(await refusalCodeOf(start(source))).toBe(DAILY_PLAN_REQUIRED);

			expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
			expect(createdLog()).toBe(false);
		}
	);

	it('refuses a start when the only plan around today has no task', async () => {
		plans = [{ organizationTeamId: TEAM, date: utcDay(0), tasks: [] }];

		expect(await refusalCodeOf(start(TimeLogSourceEnum.TEAMS))).toBe(DAILY_PLAN_REQUIRED);
	});

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'refuses a %s start for a task that is in no plan around today',
		async (source) => {
			plans = [{ organizationTeamId: TEAM, date: utcDay(0), tasks: [{ id: 'task-2' }] }];

			expect(await refusalCodeOf(start(source))).toBe(TASK_NOT_PLANNED);
			expect(createdLog()).toBe(false);
		}
	);

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'starts a %s timer on a planned task',
		async (source) => {
			plans = [{ organizationTeamId: TEAM, date: utcDay(0), tasks: [{ id: 'task-1' }] }];

			await start(source);

			expect(createdLog()).toBe(true);
		}
	);

	it("without a named day, counts the day on each side of the server's, where a member far from UTC may already or still be", async () => {
		plans = [{ organizationTeamId: TEAM, date: utcDay(1), tasks: [{ id: 'task-1' }] }];
		await start(TimeLogSourceEnum.MOBILE);

		plans = [{ organizationTeamId: TEAM, date: utcDay(-1), tasks: [{ id: 'task-1' }] }];
		await start(TimeLogSourceEnum.MOBILE);

		expect(execute.mock.calls.filter(([command]) => command instanceof TimeLogCreateCommand)).toHaveLength(2);
	});

	describe("when the client names the member's day", () => {
		const startOnDay = (planDay: string) =>
			service.startTimer({
				source: TimeLogSourceEnum.TEAMS,
				organizationTeamId: TEAM,
				taskId: 'task-1',
				planDay
			});

		it('starts on a plan for that day', async () => {
			plans = [{ organizationTeamId: TEAM, date: utcDay(1), tasks: [{ id: 'task-1' }] }];

			await startOnDay('2026-11-06');

			expect(createdLog()).toBe(true);
		});

		it('refuses when the only plan is for the next day', async () => {
			plans = [{ organizationTeamId: TEAM, date: utcDay(1), tasks: [{ id: 'task-1' }] }];

			expect(await refusalCodeOf(startOnDay('2026-11-05'))).toBe(DAILY_PLAN_REQUIRED);
			expect(createdLog()).toBe(false);
		});

		it('keeps the days around today for a day that is today nowhere', async () => {
			plans = [{ organizationTeamId: TEAM, date: utcDay(1), tasks: [{ id: 'task-1' }] }];

			await startOnDay('2026-11-08');

			expect(createdLog()).toBe(true);
		});
	});

	it('does not count a plan two days away', async () => {
		plans = [{ organizationTeamId: TEAM, date: utcDay(2), tasks: [{ id: 'task-1' }] }];

		expect(await refusalCodeOf(start(TimeLogSourceEnum.TEAMS))).toBe(DAILY_PLAN_REQUIRED);
	});

	it('does not count a plan of another team, or an archived plan', async () => {
		plans = [
			{ organizationTeamId: OTHER_TEAM, date: utcDay(0), tasks: [{ id: 'task-1' }] },
			{ organizationTeamId: TEAM, date: utcDay(0), tasks: [{ id: 'task-1' }], isArchived: true }
		];

		expect(await refusalCodeOf(start(TimeLogSourceEnum.TEAMS))).toBe(DAILY_PLAN_REQUIRED);
	});

	const foreignPlanOwners: [string, Partial<PlanRow>][] = [
		['another employee', { employeeId: 'employee-2' }],
		['another organization', { organizationId: 'organization-other' }],
		['another tenant', { tenantId: 'tenant-other' }]
	];

	it.each(foreignPlanOwners)('does not count a plan of %s', async (_owner, owner) => {
		plans = [{ organizationTeamId: TEAM, date: utcDay(0), tasks: [{ id: 'task-1' }], ...owner }];

		expect(await refusalCodeOf(start(TimeLogSourceEnum.TEAMS))).toBe(DAILY_PLAN_REQUIRED);
	});

	it("does not apply the rule of another tenant's team", async () => {
		storedTeam = { ...storedTeam, tenantId: 'tenant-other' };

		await start(TimeLogSourceEnum.TEAMS);

		expect(find).not.toHaveBeenCalled();
		expect(createdLog()).toBe(true);
	});

	it('starts without looking for a plan when the team does not require one', async () => {
		requirePlanToTrack = false;

		await start(TimeLogSourceEnum.TEAMS);

		expect(find).not.toHaveBeenCalled();
		expect(createdLog()).toBe(true);
	});

	it.each([TimeLogSourceEnum.DESKTOP, TimeLogSourceEnum.WEB_TIMER, TimeLogSourceEnum.BROWSER_EXTENSION])(
		'leaves a %s start as it was: no team or plan lookup',
		async (source) => {
			await start(source);

			expect(findOne).not.toHaveBeenCalled();
			expect(find).not.toHaveBeenCalled();
			expect(createdLog()).toBe(true);
		}
	);
});

describe('planDatesAroundToday', () => {
	it('spans from the start of the day before to the end of the day after, in UTC', () => {
		const { from, to } = planDatesAroundToday(moment.utc('2026-11-05T21:30:00Z'));

		expect(from.toISOString()).toBe('2026-11-04T00:00:00.000Z');
		expect(to.toISOString()).toBe('2026-11-06T23:59:59.999Z');
	});
});
