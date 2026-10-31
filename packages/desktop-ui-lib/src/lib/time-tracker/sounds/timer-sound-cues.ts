import { EMPTY, Observable, OperatorFunction } from 'rxjs';
import { IgnitionState, ITimerIgnition, TimerStartMode } from '../+state/time-tracker.store';

/** The sound played when this computer starts tracking, or stops. */
export type TimerSoundCue = 'start' | 'stop';

/** What the cues know of the timer: whether this computer tracks time, and the cue of the last change. */
export interface ITimerSoundCueState {
	/** `true` while this computer tracks time (a timer it started, not one it only shows for another device). */
	tracking: boolean;
	/** The cue of the last change, `null` when it calls for none. */
	cue: TimerSoundCue | null;
	/**
	 * While the cues are quiet (an internal split of the timer, such as the midnight rollover): whether this computer
	 * tracked time when they went quiet. `null` while they are not quiet.
	 */
	trackingBeforeQuiet: boolean | null;
}

/**
 * Whether an ignition says this computer tracks time: started here (by a click, the tray, a shortcut),
 * not a timer of another device that this one only shows (`TimerStartMode.REMOTE`).
 */
export function isTrackingHere(ignition: ITimerIgnition | null | undefined): boolean {
	return ignition?.state === IgnitionState.STARTED && ignition?.mode === TimerStartMode.MANUAL;
}

/** The state of the cues when they start watching: no cue for what was already the case. */
export function initialTimerSoundCueState(
	ignition: ITimerIgnition | null | undefined,
	quiet = false
): ITimerSoundCueState {
	const tracking = isTrackingHere(ignition);
	return { tracking, cue: null, trackingBeforeQuiet: quiet ? tracking : null };
}

/**
 * The next state of the cues after an ignition change (#7141):
 * - this computer started tracking: `start`;
 * - this computer stopped tracking: `stop`;
 * - anything else (a start or stop under way, a failed start, a timer of another device, a silent restart that only
 *   changes the task): no cue.
 * While the cues are quiet, the change is followed but not cued.
 */
export function nextTimerSoundCue(
	previous: ITimerSoundCueState,
	ignition: ITimerIgnition | null | undefined
): ITimerSoundCueState {
	let tracking = previous.tracking;
	let cue: TimerSoundCue | null = null;
	switch (ignition?.state) {
		case IgnitionState.STARTED:
			tracking = isTrackingHere(ignition);
			cue = tracking && !previous.tracking ? 'start' : null;
			break;
		case IgnitionState.STOPPED:
			tracking = false;
			cue = previous.tracking ? 'stop' : null;
			break;
	}
	const quiet = previous.trackingBeforeQuiet !== null;
	return { tracking, cue: quiet ? null : cue, trackingBeforeQuiet: previous.trackingBeforeQuiet };
}

/**
 * The next state of the cues when they go quiet or speak again. A quiet stretch (the midnight rollover stops the
 * timer and starts it again) cues only what it changed in the end: nothing when the timer runs again, `stop` when
 * it stayed stopped.
 */
export function quietTimerSoundCue(previous: ITimerSoundCueState, quiet: boolean): ITimerSoundCueState {
	const wasQuiet = previous.trackingBeforeQuiet !== null;
	if (quiet) {
		return {
			tracking: previous.tracking,
			cue: null,
			trackingBeforeQuiet: wasQuiet ? previous.trackingBeforeQuiet : previous.tracking
		};
	}
	if (!wasQuiet) {
		return { ...previous, cue: null };
	}
	const before = previous.trackingBeforeQuiet;
	const cue: TimerSoundCue | null = previous.tracking === before ? null : previous.tracking ? 'start' : 'stop';
	return { tracking: previous.tracking, cue, trackingBeforeQuiet: null };
}

/**
 * Turns the ignition changes of the time tracker into the cues to play; the first ignition is the starting point.
 *
 * @param quiet$ `true` while the cues should be quiet (see {@link quietTimerSoundCue}). The cues complete with the
 * ignition changes, whatever `quiet$` does.
 */
export function timerSoundCues(quiet$: Observable<boolean> = EMPTY): OperatorFunction<ITimerIgnition, TimerSoundCue> {
	return (ignition$) =>
		new Observable<TimerSoundCue>((subscriber) => {
			let state: ITimerSoundCueState | null = null;
			let quiet = false;
			const update = (next: ITimerSoundCueState) => {
				state = next;
				if (next.cue) {
					subscriber.next(next.cue);
				}
			};

			const quietSubscription = quiet$.subscribe({
				next: (value) => {
					quiet = !!value;
					if (state) {
						update(quietTimerSoundCue(state, quiet));
					}
				},
				error: (error) => subscriber.error(error)
			});
			const ignitionSubscription = ignition$.subscribe({
				next: (ignition) =>
					update(state ? nextTimerSoundCue(state, ignition) : initialTimerSoundCueState(ignition, quiet)),
				error: (error) => subscriber.error(error),
				complete: () => subscriber.complete()
			});

			return () => {
				quietSubscription.unsubscribe();
				ignitionSubscription.unsubscribe();
			};
		});
}
