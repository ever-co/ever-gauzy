import { ITimeSlot } from '@gauzy/contracts';
import { SequenceQueue } from './sequence-queue';

/**
 * A time log deleted on the server (from another place, or straight from the database) can never be synced. The
 * queue skips that timer's pending work and moves on, instead of failing on a 404 on every cycle.
 */
describe('SequenceQueue, a timer whose time log was deleted', () => {
	const invoke = jest.fn().mockResolvedValue(undefined);
	const timeTracker = {
		getTimeLogById: jest.fn(),
		toggleApiStart: jest.fn(),
		toggleApiStop: jest.fn(),
		updateTimeLog: jest.fn(),
		addTimeLog: jest.fn(),
		pushToTimeSlot: jest.fn()
	};
	const errorHandler = { handleError: jest.fn() };
	const auditLog = { timerAuditLogInfo: jest.fn() };
	const interval = { id: 1, startedAt: new Date('2026-01-01T10:00:00Z'), screenshots: [] } as unknown as ITimeSlot;

	const queue = (store: object = {}) =>
		new SequenceQueue(
			{ ipcRenderer: { invoke } } as never,
			errorHandler as never,
			{ organizationId: 'o', tenantId: 't', ...store } as never,
			{ set viewQueueStateUpdater(_: unknown) {} } as never,
			timeTracker as never,
			{ status: jest.fn().mockResolvedValue({}) } as never,
			auditLog as never
		);

	beforeEach(() => {
		jest.clearAllMocks();
		timeTracker.getTimeLogById.mockResolvedValue(null); // the API answered 404
	});

	const calls = (channel: string) => invoke.mock.calls.filter(([name]) => name === channel);

	it.each([
		['started offline', { id: 7, timelogId: 'gone', isStartedOffline: true }],
		['stopped offline', { id: 7, timelogId: 'gone', isStoppedOffline: true }],
		['running with pending slots', { id: 7, timelogId: 'gone' }]
	])('skips a timer %s, marks it and its slots synced, and reports no error', async (_, timer) => {
		await queue().synchronize({ timer, intervals: [interval] });

		expect(timeTracker.pushToTimeSlot).not.toHaveBeenCalled();
		expect(timeTracker.toggleApiStop).not.toHaveBeenCalled();
		expect(timeTracker.updateTimeLog).not.toHaveBeenCalled();
		expect(calls('UPDATE_SYNCED')).toHaveLength(1);
		expect(calls('UPDATE_SYNCED')[0][1]).toMatchObject({ id: 1, remoteId: null });
		expect(calls('UPDATE_SYNCED_TIMER')).toHaveLength(1);
		expect(calls('UPDATE_SYNCED_TIMER')[0][1].lastTimer).toEqual({ id: 'gone' });
		expect(errorHandler.handleError).not.toHaveBeenCalled();
		expect(auditLog.timerAuditLogInfo).toHaveBeenCalledWith(expect.stringContaining('no longer exists'));
	});

	it('asks the server for a deleted time log once, however many things it would have done with it', async () => {
		await queue().synchronize({
			timer: { id: 7, timelogId: 'gone', isStoppedOffline: true },
			intervals: [interval]
		});

		expect(timeTracker.getTimeLogById).toHaveBeenCalledTimes(1);
	});

	it('skips the timer of the signed-in employee', async () => {
		await queue({ user: { employee: { id: 'employee-a' } } }).synchronize({
			timer: { id: 7, timelogId: 'gone', employeeId: 'employee-a' },
			intervals: [interval]
		});

		expect(calls('UPDATE_SYNCED')).toHaveLength(1);
		expect(calls('UPDATE_SYNCED_TIMER')).toHaveLength(1);
	});

	it('keeps the pending work of another employee (organization switched), whose log is out of reach', async () => {
		await queue({ user: { employee: { id: 'employee-b' } } }).synchronize({
			timer: { id: 7, timelogId: 'out-of-reach', employeeId: 'employee-a' },
			intervals: [interval]
		});

		expect(timeTracker.pushToTimeSlot).not.toHaveBeenCalled();
		expect(calls('UPDATE_SYNCED')).toHaveLength(0);
		expect(calls('UPDATE_SYNCED_TIMER')).toHaveLength(0);
	});

	it('syncs as before when the time log exists', async () => {
		timeTracker.getTimeLogById.mockResolvedValue({ id: 'tl', isRunning: true });
		timeTracker.toggleApiStop.mockResolvedValue({ id: 'tl', duration: 5 });

		await queue().synchronize({ timer: { id: 7, timelogId: 'tl', isStoppedOffline: true }, intervals: [] });

		expect(timeTracker.toggleApiStop).toHaveBeenCalledTimes(1);
		expect(calls('UPDATE_SYNCED')).toHaveLength(0);
	});
});
