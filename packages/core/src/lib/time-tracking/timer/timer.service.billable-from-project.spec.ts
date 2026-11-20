// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { IUser, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { OrganizationProject, Task } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * A start that sends `billableFromProject` is billable as its project is set: the project it names, else its task's,
 * a project with no setting counting as not billable (ever-co/ever-teams#5571). A start without it, and a run without
 * a project, keep the `isBillable` they send, and a break is never billable.
 */
describe('TimerService.startTimer with billableFromProject', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const employee = {
		id: 'employee-1',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: true,
		organization: { allowBreaks: true }
	};

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let findOne: jest.Mock;
	let projectBillable: boolean | null;

	const loggedBillable = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input.isBillable;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		projectBillable = true;
		findOne = jest.fn(async (entity: unknown) => {
			if (entity === Task) {
				return { id: 'task-1', projectId: 'project-of-task' };
			}
			if (entity === OrganizationProject) {
				return { id: 'project-1', billable: projectBillable };
			}
			return null;
		});
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ manager: { findOne } } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, { stopPreviousRunningTimers: jest.fn(async () => undefined) });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it.each([
		[true, true, true],
		[false, true, false],
		[null, true, false],
		[true, false, true]
	])(
		'records a run on a project set to %s, sent with isBillable %s, as billable %s',
		async (billable, isBillable, expected) => {
			projectBillable = billable;
			await service.startTimer({
				source: TimeLogSourceEnum.EMBED,
				projectId: 'project-1',
				isBillable,
				billableFromProject: true
			});

			expect(findOne).toHaveBeenCalledWith(OrganizationProject, {
				where: { id: 'project-1', tenantId: fixture.tenantId, organizationId: fixture.organizationId },
				select: { id: true, billable: true }
			});
			expect(loggedBillable()).toBe(expected);
		}
	);

	it("reads the task's project for a run that names only a task", async () => {
		projectBillable = false;
		await service.startTimer({
			source: TimeLogSourceEnum.EMBED,
			taskId: 'task-1',
			isBillable: true,
			billableFromProject: true
		});

		expect(loggedBillable()).toBe(false);
	});

	it('keeps the isBillable of a run without a project', async () => {
		await service.startTimer({ source: TimeLogSourceEnum.EMBED, isBillable: true, billableFromProject: true });

		expect(loggedBillable()).toBe(true);
		expect(findOne).not.toHaveBeenCalledWith(OrganizationProject, expect.anything());
	});

	it('never makes a break billable', async () => {
		await service.startTimer({
			source: TimeLogSourceEnum.EMBED,
			logType: TimeLogType.BREAK,
			projectId: 'project-1',
			billableFromProject: true
		});

		expect(loggedBillable()).toBe(false);
	});

	it('CONTROL: a start without billableFromProject keeps its isBillable and reads no project', async () => {
		projectBillable = false;
		await service.startTimer({ source: TimeLogSourceEnum.EMBED, projectId: 'project-1', isBillable: true });

		expect(loggedBillable()).toBe(true);
		expect(findOne).not.toHaveBeenCalledWith(OrganizationProject, expect.anything());
	});
});
