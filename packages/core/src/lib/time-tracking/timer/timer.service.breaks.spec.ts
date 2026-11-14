// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ITimeLog, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TimerService } from './timer.service';

/**
 * Breaks (#11920) on the timer paths that the other timer specs do not reach: a break never cuts other entries
 * when it stops, and the worked status never reports a break's time as worked.
 */
describe('TimerService and breaks', () => {
	const HOUR_AGO = new Date(Date.now() - 3600 * 1000);

	const runningLog = (logType: TimeLogType): ITimeLog =>
		({
			id: 'run',
			employeeId: 'employee-1',
			organizationId: 'organization-1',
			tenantId: 'tenant-1',
			logType,
			source: TimeLogSourceEnum.WEB_TIMER,
			isRunning: true,
			startedAt: HOUR_AGO,
			stoppedAt: HOUR_AGO,
			timeSlots: []
		}) as ITimeLog;

	/** A timer service whose stop runs for real down to the overlap cleanup, which is spied. */
	const serviceStopping = (log: ITimeLog) => {
		const service = Object.create(TimerService.prototype) as TimerService;
		const handleConflictingTimeLogs = jest.fn(async () => undefined);
		Object.assign(service, {
			logger: { warn: jest.fn(), debug: jest.fn(), log: jest.fn() },
			findEmployee: jest.fn(async () => ({ id: 'employee-1', organizationId: 'organization-1' })),
			getLastRunningLog: jest.fn(async () => log),
			// What the stop reads besides the run: the runs going, the logs it overlaps, then the tracking status it writes
			getLastRunningLogs: jest.fn(async () => [log]),
			findOverlappingLogIds: jest.fn(async () => ['older-entry']),
			markNotTrackingAfterStop: jest.fn(async () => undefined),
			assertStopIsForRunningLog: jest.fn(),
			_commandBus: { execute: jest.fn(async () => ({ ...log, isRunning: false, stoppedAt: new Date() })) },
			_employeeService: { update: jest.fn() },
			stopPreviousRunningTimers: jest.fn(async () => undefined),
			handleConflictingTimeLogs
		});
		return { service, handleConflictingTimeLogs };
	};

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('stops a break without reading its overlaps: the cleanup gets none, so it cuts no work its range covers', async () => {
		const { service, handleConflictingTimeLogs } = serviceStopping(runningLog(TimeLogType.BREAK));

		await service.stopTimer({ source: TimeLogSourceEnum.WEB_TIMER });

		expect((service as unknown as { findOverlappingLogIds: jest.Mock }).findOverlappingLogIds).not.toHaveBeenCalled();
		expect(handleConflictingTimeLogs).toHaveBeenCalledWith(
			expect.anything(),
			'tenant-1',
			'organization-1',
			false,
			[]
		);
	});

	it('still clears the overlaps when a work run stops', async () => {
		const { service, handleConflictingTimeLogs } = serviceStopping(runningLog(TimeLogType.TRACKED));

		await service.stopTimer({ source: TimeLogSourceEnum.WEB_TIMER });

		expect(handleConflictingTimeLogs).toHaveBeenCalledTimes(1);
	});
});
