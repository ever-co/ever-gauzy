import { filter, map, OperatorFunction, scan } from 'rxjs';
import { IgnitionState, ITimerIgnition, TimerStartMode } from '../+state/time-tracker.store';

/** The sound played when this computer starts tracking, or stops. */
export type TimerSoundCue = 'start' | 'stop';

/** What the cues know of the timer: whether this computer tracks time, and the cue of the last change. */
export interface ITimerSoundCueState {
	/** `true` while this computer tracks time (a timer it started, not one it only shows for another device). */
	tracking: boolean;
	/** The cue of the last change, `null` when it calls for none. */
	cue: TimerSoundCue | null;
}

/**
 * Whether an ignition says this computer tracks time: started here (by a click, the tray, a shortcut, a restart),
 * not a timer of another device that this one only shows (`TimerStartMode.REMOTE`).
 */
export function isTrackingHere(ignition: ITimerIgnition | null | undefined): boolean {
	return ignition?.state === IgnitionState.STARTED && ignition?.mode === TimerStartMode.MANUAL;
}

/** The state of the cues when they start watching: no cue for what was already the case. */
export function initialTimerSoundCueState(ignition: ITimerIgnition | null | undefined): ITimerSoundCueState {
	return { tracking: isTrackingHere(ignition), cue: null };
}

/**
 * The next state of the cues after an ignition change (#7141):
 * - this computer started tracking: `start`;
 * - this computer stopped tracking: `stop`;
 * - anything else (a start or stop under way, a failed start, a timer of another device, a silent restart that only
 *   changes the task): no cue.
 */
export function nextTimerSoundCue(
	previous: ITimerSoundCueState,
	ignition: ITimerIgnition | null | undefined
): ITimerSoundCueState {
	switch (ignition?.state) {
		case IgnitionState.STARTED: {
			const tracking = isTrackingHere(ignition);
			return { tracking, cue: tracking && !previous.tracking ? 'start' : null };
		}
		case IgnitionState.STOPPED:
			return { tracking: false, cue: previous.tracking ? 'stop' : null };
		default:
			return { tracking: previous.tracking, cue: null };
	}
}

/** Turns the ignition changes of the time tracker into the cues to play; the first ignition is the starting point. */
export function timerSoundCues(): OperatorFunction<ITimerIgnition, TimerSoundCue> {
	return (ignition$) =>
		ignition$.pipe(
			scan<ITimerIgnition, ITimerSoundCueState | null>(
				(state, ignition) => (state ? nextTimerSoundCue(state, ignition) : initialTimerSoundCueState(ignition)),
				null
			),
			map((state) => state?.cue ?? null),
			filter((cue): cue is TimerSoundCue => cue !== null)
		);
}
