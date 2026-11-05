// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { OrganizationTeamEmployee } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * Ever Teams turns an employee's tracking off per team, and hides the timer then. An Ever Teams start for that team
 * (an open tab from before, the mobile app) still went through. It is refused now, for the Ever Teams clients only:
 * the other clients of this API never set the team switch.
 */
/** Applies a TypeORM condition as the database would: a plain value, `Or`, `IsNull` and `Equal`. */
function matchesCondition(value: unknown, condition: unknown): boolean {
	if (!(condition instanceof FindOperator)) {
		return value === condition;
	}
	switch (condition.type) {
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

describe('TimerService.startTimer with tracking turned off in the team', () => {
	const TEAM = 'team-support';
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
	let findMembership: jest.Mock;
	let membership: {
		id: string;
		isTrackingEnabled: boolean;
		isActive?: boolean | null;
		isArchived?: boolean | null;
	} | null;
	let stopPreviousRunningTimers: jest.Mock;

	const startFrom = (source: TimeLogSourceEnum) => service.startTimer({ source, organizationTeamId: TEAM });

	/** The stored membership when it passes the status conditions the lookup states. */
	const membershipMatching = (where: Record<string, unknown>) => {
		if (!membership) {
			return null;
		}
		const storedStatus: Record<string, unknown> = {
			isActive: membership.isActive ?? null,
			isArchived: membership.isArchived ?? null
		};
		const statusKeys = Object.keys(storedStatus).filter((key) => key in where);
		const keepsStatus = statusKeys.every((key) => matchesCondition(storedStatus[key], where[key]));
		if (!keepsStatus) {
			return null;
		}
		return membership;
	};

	const createdLog = () => execute.mock.calls.some(([command]) => command instanceof TimeLogCreateCommand);

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		membership = { id: 'member-1', isTrackingEnabled: false, isActive: true, isArchived: false };
		findMembership = jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) =>
			membershipMatching(where)
		);
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ manager: { findOne: findMembership } } as never,
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
	});

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'refuses a %s start for a team where the tracking is off',
		async (source) => {
			await expect(startFrom(source)).rejects.toThrow(
				new ForbiddenException('Time tracking is turned off for you in this team.')
			);

			expect(findMembership).toHaveBeenCalledWith(OrganizationTeamEmployee, {
				where: expect.objectContaining({
					employeeId: 'employee-1',
					organizationTeamId: TEAM,
					organizationId: fixture.organizationId,
					tenantId: fixture.tenantId
				}),
				select: { id: true, isTrackingEnabled: true }
			});
			expect(createdLog()).toBe(false);
			expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
		}
	);

	it('refuses for a membership stored without a status, which counts as current', async () => {
		membership = { id: 'member-1', isTrackingEnabled: false, isActive: null, isArchived: null };

		await expect(startFrom(TimeLogSourceEnum.TEAMS)).rejects.toThrow(ForbiddenException);
		expect(createdLog()).toBe(false);
	});

	it('starts when the tracking is on in the team', async () => {
		membership = { id: 'member-1', isTrackingEnabled: true };

		await startFrom(TimeLogSourceEnum.TEAMS);

		expect(createdLog()).toBe(true);
	});

	it.each([
		['inactive', { isActive: false }],
		['archived', { isArchived: true }]
	])('starts when the membership with tracking off is %s', async (_, status) => {
		membership = { id: 'member-1', isTrackingEnabled: false, ...status };

		await startFrom(TimeLogSourceEnum.TEAMS);

		expect(createdLog()).toBe(true);
	});

	it('starts when the employee is not a member of that team', async () => {
		membership = null;

		await startFrom(TimeLogSourceEnum.TEAMS);

		expect(createdLog()).toBe(true);
	});

	it('starts without a team, without reading any membership', async () => {
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS });

		expect(findMembership).not.toHaveBeenCalled();
		expect(createdLog()).toBe(true);
	});

	it.each([TimeLogSourceEnum.DESKTOP, TimeLogSourceEnum.WEB_TIMER])(
		'leaves a %s start as it was, team switch or not',
		async (source) => {
			await startFrom(source);

			expect(findMembership).not.toHaveBeenCalled();
			expect(createdLog()).toBe(true);
		}
	);
});
