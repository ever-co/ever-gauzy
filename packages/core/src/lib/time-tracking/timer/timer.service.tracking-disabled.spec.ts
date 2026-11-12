// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException, NotAcceptableException } from '@nestjs/common';
import { IUser } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { IGetConflictTimeLogCommand, TimeLogCreateCommand, TimeLogUpdateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * Turning an employee's tracking off refused the stop as well as the start. A timer still running at that moment could
 * then be stopped by nobody: the clients hide the controls and a stop got the same 403, so the log kept counting time.
 * The start stays refused; the stop of a running timer goes through.
 */
describe('TimerService with the employee tracking turned off', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const employee = {
		id: 'employee-1',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: false
	};
	const runningLog = {
		id: 'log-running',
		employeeId: employee.id,
		startedAt: new Date('2026-11-04T09:00:00.000Z'),
		isRunning: true
	};
	const stoppedAt = new Date('2026-11-04T10:00:00.000Z');

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let updateEmployee: jest.Mock;
	let lastRunningLog: typeof runningLog | null;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		lastRunningLog = runningLog;
		execute = jest.fn(async (command: unknown) => {
			if (command instanceof TimeLogUpdateCommand) {
				return { ...runningLog, ...command.input };
			}
			// The logs the running one overlaps, which the stop reads before its update
			if (command instanceof IGetConflictTimeLogCommand) {
				return [];
			}
			return { id: 'log-new' };
		});
		updateEmployee = jest.fn(async () => undefined);
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: updateEmployee };
		service = new TimerService(
			{ find: jest.fn(async () => []) } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, {
			getLastRunningLogs: jest.fn(async () => (lastRunningLog ? [lastRunningLog] : [])),
			calculateStoppedAt: jest.fn(async () => stoppedAt),
			stopPreviousRunningTimers: jest.fn(async () => undefined),
			handleConflictingTimeLogs: jest.fn(async () => undefined)
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('stops the timer that was running when tracking was turned off', async () => {
		const stopped = await service.stopTimer({});

		expect(stopped).toMatchObject({ id: 'log-running', isRunning: false, stoppedAt });
		const commands = execute.mock.calls.map(([command]) => command);
		const update = commands.find((command) => command instanceof TimeLogUpdateCommand) as TimeLogUpdateCommand;
		expect(update).toBeInstanceOf(TimeLogUpdateCommand);
		expect(update.id).toBe('log-running');
		expect(updateEmployee).toHaveBeenCalledWith(employee.id, { isOnline: false, isTrackingTime: false });
	});

	it('still answers that nothing is running when no timer runs', async () => {
		lastRunningLog = null;

		await expect(service.stopTimer({})).rejects.toThrow(NotAcceptableException);
		expect(execute).not.toHaveBeenCalled();
	});

	it('still refuses to start a timer', async () => {
		await expect(service.startTimer({})).rejects.toThrow(ForbiddenException);
		const created = execute.mock.calls.some(([command]) => command instanceof TimeLogCreateCommand);
		expect(created).toBe(false);
	});
});
