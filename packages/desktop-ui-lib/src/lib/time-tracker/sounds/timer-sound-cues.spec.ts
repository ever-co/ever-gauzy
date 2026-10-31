import { firstValueFrom, from, toArray } from 'rxjs';
import { IgnitionState, ITimerIgnition, TimerStartMode } from '../+state/time-tracker.store';
import {
	initialTimerSoundCueState,
	isTrackingHere,
	nextTimerSoundCue,
	TimerSoundCue,
	timerSoundCues
} from './timer-sound-cues';

/** The ignition changes the time tracker makes (time-tracker.component.ts, TimeTrackerStore.ignition merges them). */
const stopped: ITimerIgnition = { state: IgnitionState.STOPPED, mode: TimerStartMode.STOP };
const starting: ITimerIgnition = { state: IgnitionState.STARTING, mode: TimerStartMode.STOP };
const startedHere: ITimerIgnition = { state: IgnitionState.STARTED, mode: TimerStartMode.MANUAL };
const startedElsewhere: ITimerIgnition = { state: IgnitionState.STARTED, mode: TimerStartMode.REMOTE };
const stopping: ITimerIgnition = { state: IgnitionState.STOPPING, mode: TimerStartMode.MANUAL };
const stoppedAfterRun: ITimerIgnition = { state: IgnitionState.STOPPED, mode: TimerStartMode.STOP };
const restarting: ITimerIgnition = { state: IgnitionState.RESTARTING, mode: TimerStartMode.MANUAL };
const restarted: ITimerIgnition = { state: IgnitionState.RESTARTED, mode: TimerStartMode.MANUAL };

function cuesOf(...ignitions: ITimerIgnition[]): Promise<TimerSoundCue[]> {
	return firstValueFrom(from(ignitions).pipe(timerSoundCues(), toArray()));
}

describe('timer sound cues', () => {
	describe('isTrackingHere', () => {
		it('is true only for a timer this computer started', () => {
			expect(isTrackingHere(startedHere)).toBe(true);
			expect(isTrackingHere(startedElsewhere)).toBe(false);
			expect(isTrackingHere(starting)).toBe(false);
			expect(isTrackingHere(stopped)).toBe(false);
			expect(isTrackingHere(null)).toBe(false);
			expect(isTrackingHere(undefined)).toBe(false);
		});
	});

	describe('nextTimerSoundCue', () => {
		const idle = initialTimerSoundCueState(stopped);
		const tracking = initialTimerSoundCueState(startedHere);

		it('starts from what is already the case, without a cue', () => {
			expect(idle).toEqual({ tracking: false, cue: null });
			expect(tracking).toEqual({ tracking: true, cue: null });
		});

		it('cues a start when this computer starts tracking', () => {
			expect(nextTimerSoundCue(idle, startedHere)).toEqual({ tracking: true, cue: 'start' });
		});

		it('cues a stop when this computer stops tracking', () => {
			expect(nextTimerSoundCue(tracking, stoppedAfterRun)).toEqual({ tracking: false, cue: 'stop' });
		});

		it('does not cue a start twice', () => {
			expect(nextTimerSoundCue(tracking, startedHere)).toEqual({ tracking: true, cue: null });
		});

		it('does not cue a stop when nothing was tracked here', () => {
			expect(nextTimerSoundCue(idle, stopped)).toEqual({ tracking: false, cue: null });
		});

		it('stays silent for a timer of another device', () => {
			expect(nextTimerSoundCue(idle, startedElsewhere)).toEqual({ tracking: false, cue: null });
		});

		it.each([starting, stopping, restarting, restarted, {} as ITimerIgnition, null])(
			'keeps what it knew through %p',
			(ignition) => {
				expect(nextTimerSoundCue(tracking, ignition)).toEqual({ tracking: true, cue: null });
				expect(nextTimerSoundCue(idle, ignition)).toEqual({ tracking: false, cue: null });
			}
		);
	});

	describe('timerSoundCues', () => {
		it('cues a start then a stop for a run of this computer', async () => {
			await expect(cuesOf(stopped, starting, startedHere, stopping, stoppedAfterRun)).resolves.toEqual([
				'start',
				'stop'
			]);
		});

		it('says nothing for what was already the case when it started watching', async () => {
			// The time tracker opened again while its timer runs: no start cue
			await expect(cuesOf(startedHere)).resolves.toEqual([]);
			await expect(cuesOf(startedHere, stopping, stoppedAfterRun)).resolves.toEqual(['stop']);
		});

		it('says nothing for a start that failed (validation, error)', async () => {
			await expect(cuesOf(stopped, starting, stopped)).resolves.toEqual([]);
		});

		it('says nothing while it only shows the timer of another device', async () => {
			await expect(cuesOf(stopped, startedElsewhere, stopping, stopped)).resolves.toEqual([]);
		});

		it('says nothing for a silent restart (another task or project while tracking)', async () => {
			await expect(cuesOf(stopped, starting, startedHere, restarting, restarted)).resolves.toEqual(['start']);
		});

		it('cues each run of a day', async () => {
			await expect(
				cuesOf(
					stopped,
					starting,
					startedHere,
					stopping,
					stoppedAfterRun,
					starting,
					startedHere,
					stoppedAfterRun
				)
			).resolves.toEqual(['start', 'stop', 'start', 'stop']);
		});

		it('cues the stop of a run of this computer whatever stopped it, then follows another device silently', async () => {
			// Another device stopped the run (or an error, or quitting): this computer stops tracking all the same
			await expect(cuesOf(stopped, startedHere, stoppedAfterRun, startedElsewhere, stopped)).resolves.toEqual([
				'start',
				'stop'
			]);
		});
	});
});
