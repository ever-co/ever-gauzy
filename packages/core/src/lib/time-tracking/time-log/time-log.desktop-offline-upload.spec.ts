// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { singleRouteBody } from '../../api/bulk-create';
import { BulkExecutor } from '../../api/bulk-executor.service';
import { FieldVisibility } from '../../api/field-visibility.service';
import { RequestContext } from '../../core/context';
import { OrganizationBelongsToUserConstraint } from '../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { OrganizationTeam } from '../../core/entities/internal';
import { DeleteTimeSpanCommand, IGetConflictTimeLogCommand, TimeLogCreateCommand } from './commands';
import { CreateManualTimeLogDTO } from './dto';
import { TRACKING_FIELD_REQUIRED } from './organization-tracking-requirements';
import { TimeLogController } from './time-log.controller';
import { TimeLogResolver } from './time-log.resolver';
import { RUNNING_TIMER_OVERLAP, TimeLogService } from './time-log.service';

/**
 * The desktop timer and the agent record time while offline, and upload it once back online: a timer stopped offline
 * becomes `POST /timesheet/time-log` with source `DESKTOP` and none of a team, and a timer still running becomes a
 * timer start. Both clients resend a refused upload on every sync, so a refusal would keep that time on the machine.
 * An organization that requires a team and a project therefore gets such an upload filled where the server can tell,
 * and recorded either way; time entered by hand through the same route is still refused.
 *
 * The bodies go through the route's own pipes, as `POST /timesheet/time-log` and its bulk twin run them.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const TASK = '00000000-0000-4000-8000-000000000030';

/** The body the desktop timer uploads for a timer stopped offline (`TimeTrackerService.addTimeLog`). */
const desktopUpload = {
	startedAt: '2026-10-01T09:00:00.000Z',
	stoppedAt: '2026-10-01T11:00:00.000Z',
	isBillable: true,
	logType: TimeLogType.TRACKED,
	source: TimeLogSourceEnum.DESKTOP,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	employeeId: EMPLOYEE,
	taskId: TASK,
	description: 'Offline work'
};

/** The body the agent uploads (`api.ts addTimeLog`): the dates and the employee only. */
const agentUpload = {
	startedAt: '2026-10-01T12:00:00.000Z',
	stoppedAt: '2026-10-01T13:00:00.000Z',
	isBillable: true,
	logType: TimeLogType.TRACKED,
	source: TimeLogSourceEnum.DESKTOP,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	employeeId: EMPLOYEE
};

/** The same interval entered by hand in a web form. */
const byHand = {
	...desktopUpload,
	logType: TimeLogType.MANUAL,
	source: TimeLogSourceEnum.WEB_TIMER
};

interface IStoredContext {
	/** The employee's active teams. */
	teamIds: string[];
	/** The project of the uploaded task. */
	taskProjectId: string | null;
	/** The default project of the employee's team. */
	teamDefaultProjectId: string | null;
}

/** By default the employee is in two teams, so no team can be filled, and nothing gives a project. */
const SEVERAL_TEAMS: IStoredContext = {
	teamIds: ['team-a', 'team-b'],
	taskProjectId: null,
	teamDefaultProjectId: null
};

/**
 * @param stored The employee's teams and the projects of the task and of the team.
 * @param overlapping The employee's logs the uploaded interval overlaps, as the conflict lookup reads them.
 * @param running The employee's running logs started before the interval ends, as the time log repository reads them.
 */
function surfaces(
	stored: IStoredContext = SEVERAL_TEAMS,
	overlapping: Record<string, unknown>[] = [],
	running: Record<string, unknown>[] = []
) {
	const created: Record<string, unknown>[] = [];
	/** The log of each slot the overlap cleanup was asked to clear. */
	const trimmed: unknown[] = [];
	const employeeRepository = {
		findOne: jest.fn(async () => ({
			id: EMPLOYEE,
			organizationId: ORGANIZATION,
			organization: { futureDateAllowed: true, allowManualTime: true, requireTeam: true, requireProject: true }
		}))
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) => {
			if (command instanceof IGetConflictTimeLogCommand) {
				return overlapping;
			}
			if (command instanceof DeleteTimeSpanCommand) {
				trimmed.push(command.timeLog.id);
				return true;
			}
			if (command instanceof TimeLogCreateCommand) {
				created.push(command.input as Record<string, unknown>);
				return { id: `log-${created.length}` };
			}
			throw new Error(`Unexpected command ${String(command)}`);
		})
	};
	const manager = {
		find: jest.fn(async () =>
			stored.teamIds.map((organizationTeamId) => ({ id: `member-${organizationTeamId}`, organizationTeamId }))
		),
		findOne: jest.fn(async (entity: unknown) => {
			if (entity === OrganizationTeam) {
				return { id: stored.teamIds[0], defaultProjectId: stored.teamDefaultProjectId };
			}
			return { id: TASK, projectId: stored.taskProjectId };
		})
	};
	const service = new TimeLogService(
		{ manager, find: jest.fn(async () => running) } as never,
		{} as never,
		employeeRepository as never,
		{} as never,
		{} as never,
		commandBus as never,
		{ canManageEmployee: jest.fn(async () => true) } as never
	);
	jest.spyOn(service as any, 'withoutEmployeeFilter').mockImplementation((callback: () => Promise<unknown>) =>
		callback()
	);
	const guard = { canActivate: jest.fn(async () => true) };
	const visibility = { canSee: () => true, assertCanSee: () => undefined } as unknown as FieldVisibility;
	const controller = new TimeLogController(service, new BulkExecutor(visibility), guard as never);

	/** `POST /timesheet/time-log`, the body run through the route's pipes first. */
	const post = async (body: Record<string, unknown>) => {
		const dto = await singleRouteBody<CreateManualTimeLogDTO>(TimeLogController, 'addManualTime')({ ...body });
		return await controller.addManualTime(dto);
	};

	const resolver = new TimeLogResolver(service, commandBus as never, new BulkExecutor(visibility), guard as never);

	return { created, trimmed, controller, post, resolver };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		employeeId: EMPLOYEE
	} as never);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission: PermissionsEnum) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
	jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /timesheet/time-log when the organization requires a team and a project', () => {
	it('records the time a desktop timer tracked offline, though no team or project can be filled', async () => {
		const { created, post } = surfaces();

		await post(desktopUpload);

		expect(created).toHaveLength(1);
		expect(created[0]).toMatchObject({
			employeeId: EMPLOYEE,
			taskId: TASK,
			organizationTeamId: null,
			projectId: null,
			logType: TimeLogType.MANUAL,
			source: TimeLogSourceEnum.WEB_TIMER
		});
		expect(created[0]).not.toHaveProperty('uploadedByTracker');
	});

	it("files a desktop upload under the single-team employee's team and the task's project", async () => {
		const { created, post } = surfaces({
			teamIds: ['team-only'],
			taskProjectId: 'project-of-task',
			teamDefaultProjectId: 'project-of-team'
		});

		await post(desktopUpload);

		expect(created[0]).toMatchObject({ organizationTeamId: 'team-only', projectId: 'project-of-task' });
	});

	it("files an agent upload, which names no task, under the team's default project", async () => {
		const { created, post } = surfaces({
			teamIds: ['team-only'],
			taskProjectId: null,
			teamDefaultProjectId: 'project-of-team'
		});

		await post(agentUpload);

		expect(created[0]).toMatchObject({ organizationTeamId: 'team-only', projectId: 'project-of-team' });
	});

	it('records the time the agent tracked offline', async () => {
		const { created, post } = surfaces();

		await post(agentUpload);

		expect(created).toHaveLength(1);
	});

	it('records every desktop upload of a bulk sync', async () => {
		const { created, controller } = surfaces();

		const result = await controller.bulk({ items: [desktopUpload, agentUpload] as never });

		expect(result).toMatchObject({ total: 2, succeededCount: 2, failedCount: 0 });
		expect(created).toHaveLength(2);
	});

	it('still refuses the same interval entered by hand, naming the missing team and project', async () => {
		const { created, post } = surfaces();

		const error = await post(byHand).catch((caught) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect(error.getResponse()).toMatchObject({
			code: TRACKING_FIELD_REQUIRED,
			fields: ['organizationTeamId', 'projectId']
		});
		expect(created).toHaveLength(0);
	});

	it('records an interval entered by hand over GraphQL under the team and project it names', async () => {
		const { created, resolver } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startedAt: new Date(byHand.startedAt),
			stoppedAt: new Date(byHand.stoppedAt),
			organizationTeamId: 'team-b',
			projectId: 'project-named'
		};

		await resolver.addManualTime(input);

		expect(created).toHaveLength(1);
		expect(created[0]).toMatchObject({ organizationTeamId: 'team-b', projectId: 'project-named' });
	});

	it('does not let a hand entry pass as an upload by saying so in its body', async () => {
		const { created, post } = surfaces();

		const error = await post({ ...byHand, uploadedByTracker: true }).catch((caught) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect(error.getResponse()).toMatchObject({ code: TRACKING_FIELD_REQUIRED });
		expect(created).toHaveLength(0);
	});
});

/**
 * #11823 — the overlap cleanup never cuts a running log, so an upload over a timer that is still running (the
 * employee's timer on another device) is refused with a 409. Both clients keep a refused upload and send it again at
 * their next sync, and once that timer has stopped the upload is recorded, its range cleared from the stopped log.
 */
describe('POST /timesheet/time-log over a timer that is still running', () => {
	/** The employee's timer, running since 10:30 with three heartbeats so far: inside the upload's 09:00–11:00. */
	const runningTimer = {
		id: 'running',
		employeeId: EMPLOYEE,
		organizationId: ORGANIZATION,
		isRunning: true,
		startedAt: new Date('2026-10-01T10:30:00.000Z'),
		stoppedAt: new Date('2026-10-01T11:00:00.000Z'),
		timeSlots: [{ id: 'running@10:30' }, { id: 'running@10:40' }, { id: 'running@10:50' }]
	};

	it('refuses the upload with a 409 and writes nothing, so the desktop keeps it for its next sync', async () => {
		const { created, trimmed, post } = surfaces(SEVERAL_TEAMS, [runningTimer]);

		const refusal = await post(desktopUpload).catch((caught) => caught);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal.getResponse()).toMatchObject({ code: RUNNING_TIMER_OVERLAP });
		expect(trimmed).toEqual([]);
		expect(created).toHaveLength(0);
	});

	it('records the same upload at the sync after that timer stopped, clearing its range from the stopped log', async () => {
		const { created, trimmed, post } = surfaces(SEVERAL_TEAMS, [{ ...runningTimer, isRunning: false }]);

		await post(desktopUpload);

		expect(trimmed).toEqual(['running', 'running', 'running']);
		expect(created).toHaveLength(1);
	});

	/**
	 * #11886: the overlap lookup matches the stored range, which ends at a running log's last heartbeat (its start, for
	 * a web timer). A timer running since before the upload that it does not reach is refused as well, unless it is a
	 * tracker's and a tracker uploads: a desktop run left open on the server when the desktop went offline ends where
	 * its time slots end, so it holds back none of the time the desktop tracked offline. Time entered by hand is refused
	 * over it, as over any running timer.
	 */
	describe('with a running timer the overlap lookup does not reach', () => {
		const since0800 = (id: string, source: TimeLogSourceEnum, lastHeartbeat: string) => ({
			id,
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION,
			source,
			isRunning: true,
			startedAt: new Date('2026-10-01T08:00:00.000Z'),
			stoppedAt: new Date(lastHeartbeat)
		});

		it('refuses the upload over a web timer running since 08:00, which posts no time slots', async () => {
			const webTimer = since0800('web', TimeLogSourceEnum.WEB_TIMER, '2026-10-01T08:00:00.000Z');
			const { created, trimmed, post } = surfaces(SEVERAL_TEAMS, [], [webTimer]);

			const refusal = await post(desktopUpload).catch((caught) => caught);

			expect(refusal).toBeInstanceOf(ConflictException);
			expect(refusal.getResponse()).toMatchObject({ code: RUNNING_TIMER_OVERLAP });
			expect(trimmed).toEqual([]);
			expect(created).toHaveLength(0);
		});

		it("records the upload beside the desktop's own run, left open on the server until 09:00, its last time slot", async () => {
			const desktopRun = since0800('desktop', TimeLogSourceEnum.DESKTOP, '2026-10-01T09:00:00.000Z');
			const { created, post } = surfaces(SEVERAL_TEAMS, [], [desktopRun]);

			await post(desktopUpload);

			expect(created).toHaveLength(1);
		});

		it("refuses the same interval entered by hand while the desktop's run still runs", async () => {
			const desktopRun = since0800('desktop', TimeLogSourceEnum.DESKTOP, '2026-10-01T09:00:00.000Z');
			// One team and the task's project, so the organization's required fields are filled
			const oneTeam = { teamIds: ['team-only'], taskProjectId: 'project-of-task', teamDefaultProjectId: null };
			const { created, trimmed, post } = surfaces(oneTeam, [], [desktopRun]);

			const refusal = await post(byHand).catch((caught) => caught);

			expect(refusal).toBeInstanceOf(ConflictException);
			expect(refusal.getResponse()).toMatchObject({ code: RUNNING_TIMER_OVERLAP });
			expect(trimmed).toEqual([]);
			expect(created).toHaveLength(0);
		});
	});
});
