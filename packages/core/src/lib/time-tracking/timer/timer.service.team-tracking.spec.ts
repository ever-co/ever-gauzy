// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
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
	let membership: { id: string; isTrackingEnabled: boolean } | null;

	const startFrom = (source: TimeLogSourceEnum) => service.startTimer({ source, organizationTeamId: TEAM });

	const createdLog = () => execute.mock.calls.some(([command]) => command instanceof TimeLogCreateCommand);

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		membership = { id: 'member-1', isTrackingEnabled: false };
		findMembership = jest.fn(async () => membership);
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ manager: { findOne: findMembership } } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never
		);
		Object.assign(service, { stopPreviousRunningTimers: jest.fn(async () => undefined) });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'refuses a %s start for a team where the tracking is off',
		async (source) => {
			await expect(startFrom(source)).rejects.toThrow(ForbiddenException);

			expect(findMembership).toHaveBeenCalledWith(OrganizationTeamEmployee, {
				where: {
					employeeId: 'employee-1',
					organizationTeamId: TEAM,
					organizationId: fixture.organizationId,
					tenantId: fixture.tenantId
				},
				select: { id: true, isTrackingEnabled: true }
			});
			expect(createdLog()).toBe(false);
		}
	);

	it('starts when the tracking is on in the team', async () => {
		membership = { id: 'member-1', isTrackingEnabled: true };

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
