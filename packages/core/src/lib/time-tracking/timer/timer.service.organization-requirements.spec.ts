// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IOrganization, ITimerToggleInput, IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { OrganizationTeam, OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TRACKING_FIELD_REQUIRED } from '../time-log/organization-tracking-requirements';
import { TimerService } from './timer.service';

/**
 * An organization can require a team and a project on every time entry, and the server now holds a timer start to
 * them when the switch is on: the team and the project are filled where the server can tell them, and a start still
 * missing one is refused. A desktop start (the desktop timer and the agent) is filled but never refused: the desktop
 * starts its clock before the server answers and resends a refused start on every sync, so a refusal would keep its
 * time on the machine. With both switches off, and for the task, client and description switches, a start goes
 * through exactly as before.
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
	let organization: Partial<IOrganization>;
	let teamsOfEmployee: string[];
	let isTrackingOnInTeam: boolean;
	let taskProjectId: string | null;
	let teamDefaultProjectId: string | null;

	const createdLog = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input;
	};

	/** A start from the Gauzy web timer, which only starts once the server accepted it. */
	const start = (input: ITimerToggleInput) => service.startTimer({ source: TimeLogSourceEnum.WEB_TIMER, ...input });

	/** The refusal of a start, as the client receives it. */
	const refusalOf = async (input: ITimerToggleInput) => {
		const error = await start(input).catch((caught) => caught);
		expect(error).toBeInstanceOf(BadRequestException);
		return (error as BadRequestException).getResponse();
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		organization = { requireTeam: false, requireProject: false };
		teamsOfEmployee = [];
		isTrackingOnInTeam = true;
		taskProjectId = 'project-of-task';
		teamDefaultProjectId = null;
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
				return { id: 'task-1', projectId: taskProjectId };
			}
			if (entity === OrganizationTeamEmployee) {
				return { id: 'member-1', isTrackingEnabled: isTrackingOnInTeam };
			}
			if (entity === OrganizationTeam) {
				return { id: 'team-only', requirePlanToTrack: false, defaultProjectId: teamDefaultProjectId };
			}
			throw new Error('Unexpected lookup');
		});
		execute = jest.fn(async () => ({ id: 'log-new' }));
		findOneByUserId = jest.fn(async () => ({
			id: 'employee-1',
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId,
			isTrackingEnabled: true,
			organization: { id: fixture.organizationId, ...organization }
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

	it('starts with nothing named when both switches are off, without any extra lookup', async () => {
		await start({ taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ projectId: null, taskId: 'task-1', organizationTeamId: null });
		expect(find).not.toHaveBeenCalled();
		expect(findOne).not.toHaveBeenCalled();
	});

	it('leaves the task, client and description switches to the clients, as before', async () => {
		organization = { requireTask: true, requireClient: true, requireDescription: true, requireReason: true };

		await start({});

		expect(createdLog()).toMatchObject({ taskId: null, organizationContactId: null, description: null });
		expect(find).not.toHaveBeenCalled();
		expect(findOne).not.toHaveBeenCalled();
	});

	it.each([
		['requireTeam', 'organizationTeamId'],
		['requireProject', 'projectId']
	] as const)('refuses a start without the field when %s is on', async (requirement, field) => {
		organization[requirement] = true;
		teamsOfEmployee = ['team-a', 'team-b'];
		taskProjectId = null;
		const complete = { organizationTeamId: 'team-named', projectId: 'project-named' };

		const refusal = await refusalOf({ ...complete, [field]: undefined });

		expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: [field] });
		expect(createdLog()).toBeUndefined();
		expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
	});

	it("files a start without a team under the employee's only active team", async () => {
		organization.requireTeam = true;
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
			organization.requireTeam = true;
			teamsOfEmployee = teams;

			const refusal = await refusalOf({});

			expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: ['organizationTeamId'] });
			expect(createdLog()).toBeUndefined();
		}
	);

	it('holds the team it filled to that team tracking switch', async () => {
		organization.requireTeam = true;
		teamsOfEmployee = ['team-only'];
		isTrackingOnInTeam = false;

		await expect(start({ source: TimeLogSourceEnum.TEAMS })).rejects.toThrow(ForbiddenException);
		expect(findOne).toHaveBeenCalledWith(
			OrganizationTeamEmployee,
			expect.objectContaining({ where: expect.objectContaining({ organizationTeamId: 'team-only' }) })
		);
		expect(createdLog()).toBeUndefined();
	});

	it("files a start that names a task but no project under the task's project when a project is required", async () => {
		organization.requireProject = true;

		await start({ taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ projectId: 'project-of-task', taskId: 'task-1' });
	});

	it("files a start under its team's default project when the task gives none and a project is required", async () => {
		organization = { requireTeam: true, requireProject: true };
		teamsOfEmployee = ['team-only'];
		taskProjectId = null;
		teamDefaultProjectId = 'project-of-team';

		await start({ taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ organizationTeamId: 'team-only', projectId: 'project-of-team' });
	});

	it('refuses a start with neither a task project nor a team default when a project is required', async () => {
		organization.requireProject = true;
		taskProjectId = null;

		const refusal = await refusalOf({ taskId: 'task-1', organizationTeamId: 'team-named' });

		expect(refusal).toMatchObject({ code: TRACKING_FIELD_REQUIRED, fields: ['projectId'] });
	});

	it('fills a desktop start but never refuses it, so the desktop never keeps its time on the machine', async () => {
		organization = { requireTeam: true, requireProject: true };
		teamsOfEmployee = ['team-a', 'team-b'];
		taskProjectId = null;
		const startedOffline = new Date(Date.now() - 3 * 60 * 60 * 1000);

		await service.startTimer({ source: TimeLogSourceEnum.DESKTOP, taskId: 'task-1', startedAt: startedOffline });

		expect(createdLog()).toMatchObject({
			source: TimeLogSourceEnum.DESKTOP,
			startedAt: startedOffline,
			organizationTeamId: null,
			projectId: null
		});
	});

	it("files a desktop start without a team under the single-team employee's team and its default project", async () => {
		organization = { requireTeam: true, requireProject: true };
		teamsOfEmployee = ['team-only'];
		taskProjectId = null;
		teamDefaultProjectId = 'project-of-team';

		await service.startTimer({ source: TimeLogSourceEnum.DESKTOP, taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ organizationTeamId: 'team-only', projectId: 'project-of-team' });
	});

	it("fills a desktop start with what the server can tell, the employee's only team and its task's project", async () => {
		organization = { requireTeam: true, requireProject: true };
		teamsOfEmployee = ['team-only'];

		await service.startTimer({ source: TimeLogSourceEnum.DESKTOP, taskId: 'task-1' });

		expect(createdLog()).toMatchObject({ organizationTeamId: 'team-only', projectId: 'project-of-task' });
	});

	it('still refuses a start when tracking is disabled for the employee, before any switch', async () => {
		organization.requireProject = true;
		findOneByUserId.mockResolvedValueOnce({
			id: 'employee-1',
			organizationId: fixture.organizationId,
			isTrackingEnabled: false,
			organization: { requireProject: true }
		});

		await expect(start({})).rejects.toThrow(ForbiddenException);
	});
});
