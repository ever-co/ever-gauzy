import { BehaviorSubject, firstValueFrom, from, Subject, toArray } from 'rxjs';
import { IgnitionState, ITimerIgnition, TimerStartMode } from '../+state/time-tracker.store';
import {
	initialTimerSoundCueState,
	isTrackingHere,
	ITimerSoundCueState,
	nextTimerSoundCue,
	quietTimerSoundCue,
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
/** What the task change dialog sets after a silent restart: `store.update({ ignition: { state: STARTED } })`. */
const startedAfterTaskChange: ITimerIgnition = { state: IgnitionState.STARTED };

function state(
	tracking: boolean,
	cue: TimerSoundCue | null = null,
	trackingBeforeQuiet: boolean | null = null
): ITimerSoundCueState {
	return { tracking, cue, trackingBeforeQuiet };
}

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
			expect(idle).toEqual(state(false));
			expect(tracking).toEqual(state(true));
			expect(initialTimerSoundCueState(startedHere, true)).toEqual(state(true, null, true));
		});

		it('cues a start when this computer starts tracking', () => {
			expect(nextTimerSoundCue(idle, startedHere)).toEqual(state(true, 'start'));
		});

		it('cues a stop when this computer stops tracking', () => {
			expect(nextTimerSoundCue(tracking, stoppedAfterRun)).toEqual(state(false, 'stop'));
		});

		it('does not cue a start twice', () => {
			expect(nextTimerSoundCue(tracking, startedHere)).toEqual(state(true));
		});

		it('does not cue a stop when nothing was tracked here', () => {
			expect(nextTimerSoundCue(idle, stopped)).toEqual(state(false));
		});

		it('stays silent for a timer of another device', () => {
			expect(nextTimerSoundCue(idle, startedElsewhere)).toEqual(state(false));
		});

		it.each([starting, stopping, restarting, restarted, {} as ITimerIgnition, null])(
			'keeps what it knew through %p',
			(ignition) => {
				expect(nextTimerSoundCue(tracking, ignition)).toEqual(state(true));
				expect(nextTimerSoundCue(idle, ignition)).toEqual(state(false));
			}
		);

		it('follows the timer without a cue while quiet', () => {
			expect(nextTimerSoundCue(state(true, null, true), stoppedAfterRun)).toEqual(state(false, null, true));
			expect(nextTimerSoundCue(state(false, null, true), startedHere)).toEqual(state(true, null, true));
		});

		it('keeps what it knew through a STARTED without a mode (the task change dialog)', () => {
			expect(nextTimerSoundCue(tracking, startedAfterTaskChange)).toEqual(state(true));
			expect(nextTimerSoundCue(idle, startedAfterTaskChange)).toEqual(state(false));
		});
	});

	describe('quietTimerSoundCue', () => {
		it('remembers whether this computer tracked time when it goes quiet', () => {
			expect(quietTimerSoundCue(state(true, 'start'), true)).toEqual(state(true, null, true));
			expect(quietTimerSoundCue(state(false), true)).toEqual(state(false, null, false));
		});

		it('keeps the first remembered value when it is already quiet', () => {
			expect(quietTimerSoundCue(state(false, null, true), true)).toEqual(state(false, null, true));
		});

		it('says nothing after a rollover that runs again (stopped, then started for the new day)', () => {
			expect(quietTimerSoundCue(state(true, null, true), false)).toEqual(state(true));
		});

		it('cues a stop when the timer stayed stopped (the restart failed)', () => {
			expect(quietTimerSoundCue(state(false, null, true), false)).toEqual(state(false, 'stop'));
		});

		it('cues a start when the timer started meanwhile', () => {
			expect(quietTimerSoundCue(state(true, null, false), false)).toEqual(state(true, 'start'));
		});

		it('changes nothing when it was not quiet', () => {
			expect(quietTimerSoundCue(state(true, 'start'), false)).toEqual(state(true));
		});
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

		it('still cues the stop of a run after a task change', async () => {
			await expect(
				cuesOf(
					stopped,
					starting,
					startedHere,
					restarting,
					restarted,
					startedAfterTaskChange,
					stopping,
					stoppedAfterRun
				)
			).resolves.toEqual(['start', 'stop']);
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

		describe('quiet stretches', () => {
			let ignition$: Subject<ITimerIgnition>;
			let quiet$: BehaviorSubject<boolean>;
			let cues: TimerSoundCue[];
			let completed: boolean;

			beforeEach(() => {
				ignition$ = new Subject<ITimerIgnition>();
				quiet$ = new BehaviorSubject(false);
				cues = [];
				completed = false;
				ignition$.pipe(timerSoundCues(quiet$)).subscribe({
					next: (cue) => cues.push(cue),
					complete: () => (completed = true)
				});
				ignition$.next(stopped);
				ignition$.next(startedHere);
				cues.length = 0;
			});

			it('says nothing for the midnight rollover (stop, then start again for the new day)', () => {
				quiet$.next(true);
				ignition$.next(stopping);
				ignition$.next(stoppedAfterRun);
				ignition$.next(starting);
				ignition$.next(startedHere);
				quiet$.next(false);

				expect(cues).toEqual([]);

				// The user stopping afterwards is cued as usual
				ignition$.next(stoppedAfterRun);
				expect(cues).toEqual(['stop']);
			});

			it('cues a stop when the rollover left the timer stopped', () => {
				quiet$.next(true);
				ignition$.next(stopping);
				ignition$.next(stoppedAfterRun);
				ignition$.next(starting);
				ignition$.next(stopped);

				expect(cues).toEqual([]);

				quiet$.next(false);
				expect(cues).toEqual(['stop']);
			});

			it('completes with the ignition changes, though the quiet stretches go on', () => {
				ignition$.complete();

				expect(completed).toBe(true);
				expect(quiet$.observed).toBe(false);
			});
		});

		it('is quiet from the first ignition when it starts watching during a quiet stretch', () => {
			const ignition$ = new Subject<ITimerIgnition>();
			const quiet$ = new BehaviorSubject(true);
			const cues: TimerSoundCue[] = [];
			ignition$.pipe(timerSoundCues(quiet$)).subscribe((cue) => cues.push(cue));

			ignition$.next(startedHere);
			ignition$.next(stoppedAfterRun);
			ignition$.next(startedHere);
			quiet$.next(false);

			expect(cues).toEqual([]);
		});
	});
});
