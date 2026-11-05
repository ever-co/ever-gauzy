// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { singleRouteBody } from '../../api/bulk-create';
import { BulkExecutor } from '../../api/bulk-executor.service';
import { FieldVisibility } from '../../api/field-visibility.service';
import { RequestContext } from '../../core/context';
import { OrganizationBelongsToUserConstraint } from '../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { OrganizationTeam } from '../../core/entities/internal';
import { IGetConflictTimeLogCommand, TimeLogCreateCommand } from './commands';
import { CreateManualTimeLogDTO } from './dto';
import { TRACKING_FIELD_REQUIRED } from './organization-tracking-requirements';
import { TimeLogController } from './time-log.controller';
import { TimeLogService } from './time-log.service';

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

function surfaces(stored: IStoredContext = SEVERAL_TEAMS) {
	const created: Record<string, unknown>[] = [];
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
				return [];
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
		{ manager } as never,
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

	return { created, controller, post };
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

	it('does not let a hand entry pass as an upload by saying so in its body', async () => {
		const { created, post } = surfaces();

		const error = await post({ ...byHand, uploadedByTracker: true }).catch((caught) => caught);

		expect(error).toBeInstanceOf(BadRequestException);
		expect(error.getResponse()).toMatchObject({ code: TRACKING_FIELD_REQUIRED });
		expect(created).toHaveLength(0);
	});
});
