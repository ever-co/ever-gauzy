import { ITimeLog, ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerService } from './timer.service';

/**
 * A stop that names no time ends the run when the stop arrived, not when its turn came: since #11842 a stop waits
 * behind another start or stop of the same employee (`inEmployeeTurn`, up to its 120 s failsafe), and that wait is no
 * worked time (Greptile on the round-4 sweep, #11931).
 */
describe('TimerService.calculateStoppedAt — a queued stop ends at the time it arrived', () => {
	const service = Object.create(TimerService.prototype) as TimerService;
	(service as any).debug = () => undefined;

	const runningLog = {
		id: 'log-1',
		source: TimeLogSourceEnum.WEB_TIMER,
		startedAt: new Date('2026-11-13T09:00:00.000Z'),
		stoppedAt: new Date('2026-11-13T09:00:00.000Z'),
		timeSlots: []
	} as unknown as ITimeLog;

	it('uses the time the stop was received when the stop names none', async () => {
		const receivedAt = new Date('2026-11-13T09:30:05.000Z');
		const request = { source: TimeLogSourceEnum.WEB_TIMER } as ITimerToggleInput;

		await expect(service.calculateStoppedAt(request, runningLog, receivedAt)).resolves.toEqual(receivedAt);
	});

	it('keeps the time the stop names, whenever it arrived', async () => {
		const asked = new Date('2026-11-13T09:20:00.000Z');
		const request = { source: TimeLogSourceEnum.WEB_TIMER, stoppedAt: asked } as ITimerToggleInput;

		await expect(
			service.calculateStoppedAt(request, runningLog, new Date('2026-11-13T09:30:05.000Z'))
		).resolves.toEqual(asked);
	});
});
