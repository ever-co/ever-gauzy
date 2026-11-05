// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ITimeLog } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { TimeLogUpdateCommand } from '../time-log/commands';
import { TrackingTurnedOffHandler } from './events/handlers/tracking-turned-off.handler';
import { TimerStoppedEvent } from './events/timer-stopped.event';
import { TrackingTurnedOffEvent } from './events/tracking-turned-off.event';
import { TimerService } from './timer.service';

/**
 * Turning an employee's tracking off left their running timer counting: the clients hide the timer once tracking is
 * off. The timer now stops at that moment, as the employee's own stop would; turned off for one team, only a timer
 * running for that team stops.
 */
describe('TimerService.stopRunningTimersOf', () => {
	const scope = { employeeId: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' };
	const runningLog = { id: 'log-running', startedAt: new Date(Date.now() - 60 * 60 * 1000), isRunning: true };

	let service: TimerService;
	let findLogs: jest.Mock;
	let execute: jest.Mock;
	let updateEmployee: jest.Mock;

	const silenceWarnings = () =>
		jest
			.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
			.mockImplementation(() => undefined);

	beforeEach(() => {
		findLogs = jest.fn().mockResolvedValueOnce([runningLog]).mockResolvedValue([]);
		execute = jest.fn(async (command: TimeLogUpdateCommand) => ({
			...runningLog,
			id: command.id,
			...command.input
		}));
		updateEmployee = jest.fn(async () => ({ affected: 1 }));
		service = new TimerService(
			{ find: findLogs } as never,
			undefined as never,
			{ update: updateEmployee } as never,
			undefined as never,
			undefined as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, { ormType: MultiORMEnum.TypeORM });
	});

	it("stops the employee's running timer now and marks them as not tracking", async () => {
		const before = new Date();

		const stopped = await service.stopRunningTimersOf(scope);

		expect(findLogs).toHaveBeenCalledWith({ where: { ...scope, isRunning: true } });
		const update = execute.mock.calls[0][0] as TimeLogUpdateCommand;
		expect(update).toBeInstanceOf(TimeLogUpdateCommand);
		expect(update.id).toBe('log-running');
		expect(update.input.isRunning).toBe(false);
		expect(update.input.stoppedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(stopped).toEqual([expect.objectContaining({ id: 'log-running', isRunning: false })]);
		expect(updateEmployee).toHaveBeenCalledWith(
			{ id: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' },
			{ isOnline: false, isTrackingTime: false }
		);
	});

	it('stops the other timers and returns them when one stop fails', async () => {
		const otherLog = { ...runningLog, id: 'log-other' };
		findLogs.mockReset();
		findLogs
			.mockResolvedValueOnce([runningLog, otherLog])
			.mockResolvedValueOnce([runningLog])
			.mockResolvedValueOnce([runningLog]);
		execute.mockRejectedValueOnce(new Error('connection reset'));
		jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(
			() => undefined
		);

		const stopped = await service.stopRunningTimersOf(scope);

		expect(stopped).toEqual([expect.objectContaining({ id: 'log-other', isRunning: false })]);
		expect(updateEmployee).not.toHaveBeenCalled();
	});

	it('turned off for one team, looks only for a timer running for that team', async () => {
		await service.stopRunningTimersOf({ ...scope, organizationTeamId: 'team-1' });

		expect(findLogs).toHaveBeenCalledWith({
			where: { ...scope, organizationTeamId: 'team-1', isRunning: true }
		});
	});

	it('keeps a stop the update saved before it failed', async () => {
		findLogs.mockReset();
		findLogs
			.mockResolvedValueOnce([runningLog])
			.mockResolvedValueOnce([{ ...runningLog, isRunning: false }])
			.mockResolvedValue([]);
		execute.mockRejectedValueOnce(new Error('time slots failed'));
		jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(
			() => undefined
		);

		const stopped = await service.stopRunningTimersOf(scope);

		expect(findLogs).toHaveBeenNthCalledWith(2, { where: { id: 'log-running', tenantId: 'tenant-1' } });
		expect(stopped).toEqual([expect.objectContaining({ id: 'log-running', isRunning: false })]);
		expect(updateEmployee).toHaveBeenCalledWith(
			{ id: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' },
			{ isOnline: false, isTrackingTime: false }
		);
	});

	it('goes on with the other timers when reading back a failed stop fails too', async () => {
		const otherLog = { ...runningLog, id: 'log-other' };
		findLogs.mockReset();
		findLogs
			.mockResolvedValueOnce([runningLog, otherLog])
			.mockRejectedValueOnce(new Error('connection reset'))
			.mockResolvedValue([]);
		execute.mockRejectedValueOnce(new Error('time slots failed'));
		silenceWarnings();

		const stopped = await service.stopRunningTimersOf(scope);

		expect(stopped).toEqual([expect.objectContaining({ id: 'log-other', isRunning: false })]);
	});

	it('still returns the stops when the running timers cannot be read afterwards', async () => {
		findLogs.mockReset();
		findLogs.mockResolvedValueOnce([runningLog]).mockRejectedValueOnce(new Error('connection reset'));
		silenceWarnings();

		const stopped = await service.stopRunningTimersOf(scope);

		expect(stopped).toEqual([expect.objectContaining({ id: 'log-running', isRunning: false })]);
		expect(updateEmployee).not.toHaveBeenCalled();
	});

	it('keeps the employee tracking while a timer of another team still runs', async () => {
		findLogs.mockReset();
		findLogs.mockResolvedValueOnce([runningLog]).mockResolvedValueOnce([{ ...runningLog, id: 'log-other-team' }]);

		const stopped = await service.stopRunningTimersOf({ ...scope, organizationTeamId: 'team-1' });

		expect(stopped).toEqual([expect.objectContaining({ id: 'log-running', isRunning: false })]);
		expect(findLogs).toHaveBeenLastCalledWith({ where: { ...scope, isRunning: true } });
		expect(updateEmployee).not.toHaveBeenCalled();
	});

	it('writes nothing when no timer runs', async () => {
		findLogs.mockReset();
		findLogs.mockResolvedValue([]);

		const stopped = await service.stopRunningTimersOf(scope);

		expect(stopped).toEqual([]);
		expect(execute).not.toHaveBeenCalled();
		expect(updateEmployee).not.toHaveBeenCalled();
	});
});

describe('TrackingTurnedOffHandler', () => {
	const scope = { employeeId: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' };

	it('stops the running timers and announces each stop like a stop of their own', async () => {
		const stoppedLog = { id: 'log-running', isRunning: false } as ITimeLog;
		const stopRunningTimersOf = jest.fn(async () => [stoppedLog]);
		const publish = jest.fn();
		const handler = new TrackingTurnedOffHandler({ stopRunningTimersOf } as never, { publish } as never);

		await handler.handle(new TrackingTurnedOffEvent(scope));

		expect(stopRunningTimersOf).toHaveBeenCalledWith(scope);
		expect(publish).toHaveBeenCalledWith(new TimerStoppedEvent(stoppedLog));
	});

	it('never throws: the tracking switch is saved by then', async () => {
		const stopRunningTimersOf = jest.fn(async () => {
			throw new Error('connection reset');
		});
		const publish = jest.fn();
		const handler = new TrackingTurnedOffHandler({ stopRunningTimersOf } as never, { publish } as never);
		jest.spyOn((handler as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(
			() => undefined
		);

		await expect(handler.handle(new TrackingTurnedOffEvent(scope))).resolves.toBeUndefined();
		expect(publish).not.toHaveBeenCalled();
	});
});
