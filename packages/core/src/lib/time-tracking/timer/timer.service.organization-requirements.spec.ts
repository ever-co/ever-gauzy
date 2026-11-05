// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ITimerToggleInput, IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { OrganizationTeam, OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { ITrackingRequirements, TRACKING_FIELD_REQUIRED } from '../time-log/organization-tracking-requirements';
import { TimerService } from './timer.service';

/**
 * An organization can require a team, a project, a task, a client and a description on every time entry. Only the
 * desktop timer and the Gauzy web timer checked these switches, so any other client started a timer without them.
 * The server now holds every start to them, and only when a switch is on: with all of them off, a start goes through
 * exactly as before.
 */
describe('TimerService.startTimer under the organization tracking requirements', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let find: jest.Mock;
	let findOne: jest.Mock;
	let findOneByUserId: jest.Mock;
	let stopPreviousRunningTimers: jest.Mock;
	let requirements: ITrackingRequirements;
	let teamsOfEmployee: string[];
	let isTrackingOnInTeam: boolean;

	const createdLog = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input;
	};

	const start = (input: ITimerToggleInput) => service.startTimer({ source: TimeLogSourceEnum.DESKTOP, ...input });

	/** The refusal of a start, as the client receives it. */
	const refusalOf = async (input: ITimerToggleInput) => {
		const error = await start(input).catch((caught) => caught);
		expect(error).toBeInstanceOf(BadRequestException);
		return (error as BadRequestException).getResponse();
	};

	const COMPLETE_START = {
		organizationTeamId: 'team-named',
		projectId: 'project-named',
		taskId: 'task-1',
		organizationContactId: 'client-1',
		description: 'Fixing the invoice export'
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		requirements = {
			requireTeam: false,
			requireProject: false,
			requireTask: false,
			requireClient: false,
			requireDescription: false
		};
		teamsOfEmployee = [];
		isTrackingOnInTeam = true;
		find = jest.fn(async (entity: unknown) => {
			if (entity !== OrganizationTeamEmployee) {
				throw new Error('Unexpected lookup');
			}
			return teamsOfEmployee.map((organizationTeamId) => ({
				id: `member-${organizationTeamId}`,
				organizationTeamId
			}));
		});
		findOne = jest.fn(async (entity: unknown) => {
			if (entity === Task) {
				return { id: 'task-1', projectId: 'project-of-task' };
			}
			if (entity === OrganizationTeamEmployee) {
				return { id: 'member-1', isTrackingEnabled: isTrackingOnInTeam };
			}
			if (entity === OrganizationTeam) {
				return { id: 'team-only', requirePlanToTrack: false };
			}
			throw new Error('Unexpected lookup');
		});
		execute = jest.fn(async () => ({ id: 'log-new' }));
		findOneByUserId = jest.fn(async () => ({
			id: 'employee-1',
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId,
			isTrackingEnabled: true,
			organization: { id: fixture.organizationId, ...requirements }
		}));
		service = new TimerService(
			{ manager: { find, findOne } } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			{ findOneByUserId, update: jest.fn() } as never,
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

	it('reads the employee with the organization whose switches the start meets', async () => {
		await start({});

		expect(findOneByUserId).toHaveBeenCalledWith(fixture.user.id, undefined, {
			where: { tenantId: fixture.tenantId },
			relations: { organization: true }
		});
	});

	it('starts with nothing named when every switch is off, without any extra lookup', async () => {
		await start({ taskId: 'task-1' });

		expect(createdLog()).toMatchObject({
			projectId: null,
			taskId: 'task-1',
			organizationContactId: null,
			organizationTeamId: null,
			description: null
		});
		expect(find).not.toHaveBeenCalled();
		expect(findOne).not.toHaveBeenCalled();
	});

	it.each([
		['requireTeam', 'organizationTeamId'],
		['requireProject', 'projectId'],
		['requireTask', 'taskId'],
		['requireClient', 'organizationContactId'],
		['requireDescription', 'description']
	] as const)('refuses a start without the field when %s is on', async (requirement, field) => {
		requirements[requirement] = true;
		teamsOfEmployee = ['team-a', 'team-b'];

		const refusal = await refusalOf({
			...COMPLETE_START,
			projectId: undefined,
			taskId: undefined,
			[field]: undefined
		});

		expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: [field] });
		expect(createdLog()).toBeUndefined();
		expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
	});

	it.each(['requireTeam', 'requireProject', 'requireTask', 'requireClient', 'requireDescription'] as const)(
		'starts a complete start when %s is on, and logs what it named',
		async (requirement) => {
			requirements[requirement] = true;

			await start(COMPLETE_START);

			expect(createdLog()).toMatchObject(COMPLETE_START);
		}
	);

	it("files a start without a team under the employee's only active team", async () => {
		requirements.requireTeam = true;
		teamsOfEmployee = ['team-only'];

		await start({});

		expect(createdLog()).toMatchObject({ organizationTeamId: 'team-only' });
		expect(find).toHaveBeenCalledWith(
			OrganizationTeamEmployee,
			expect.objectContaining({
				where: expect.objectContaining({
					employeeId: 'employee-1',
					organizationId: fixture.organizationId,
					tenantId: fixture.tenantId
				})
			})
		);
	});

	it.each([[['team-a', 'team-b']], [[]]])(
		'refuses a start without a team for an employee in the teams %p',
		async (teams) => {
			requirements.requireTeam = true;
			teamsOfEmployee = teams;

			const refusal = await refusalOf({});

			expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: ['organizationTeamId'] });
			expect(createdLog()).toBeUndefined();
		}
	);

	it('holds the team it filled to that team tracking switch', async () => {
		requirements.requireTeam = true;
		teamsOfEmployee = ['team-only'];
		isTrackingOnInTeam = false;

		await expect(start({ source: TimeLogSourceEnum.TEAMS })).rejects.toThrow(ForbiddenException);
		expect(findOne).toHaveBeenCalledWith(
			OrganizationTeamEmployee,
			expect.objectContaining({ where: expect.objectContaining({ organizationTeamId: 'team-only' }) })
		);
		expect(createdLog()).toBeUndefined();
	});

	it("files a desktop start that names a task but no project under the task's project when a project is required", async () => {
		requirements.requireProject = true;

		await start({ taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ projectId: 'project-of-task', taskId: 'task-1' });
	});

	it('refuses a start whose task has no project when a project is required', async () => {
		requirements.requireProject = true;
		findOne.mockResolvedValueOnce({ id: 'task-1', projectId: null });

		const refusal = await refusalOf({ taskId: 'task-1' });

		expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: ['projectId'] });
	});

	it('still refuses a start when tracking is disabled for the employee, before any switch', async () => {
		requirements.requireProject = true;
		findOneByUserId.mockResolvedValueOnce({
			id: 'employee-1',
			organizationId: fixture.organizationId,
			isTrackingEnabled: false,
			organization: { requireProject: true }
		});

		await expect(start({})).rejects.toThrow(ForbiddenException);
	});
});
