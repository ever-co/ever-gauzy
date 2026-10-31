import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ElectronService } from '../../electron/services';
import { ITimerIgnition } from '../+state/time-tracker.store';
import { TimerSoundCue, timerSoundCues } from './timer-sound-cues';
import {
	DEFAULT_TIMER_SOUND_TONES,
	ITimerSoundAudioContext,
	scheduleTones,
	TIMER_SOUND_VOLUME,
	TimerSoundToneSet
} from './timer-sound-tones';

/** An audio context the cues can play on, and wake up when the page suspended it. */
export type ITimerSoundOutput = ITimerSoundAudioContext & Partial<Pick<AudioContext, 'state' | 'resume'>>;

/** Creates the audio context of the cues, `null` where the Web Audio API is missing. Replaced by the specs. */
export const TIMER_SOUND_AUDIO_CONTEXT = new InjectionToken<() => ITimerSoundOutput | null>(
	'TIMER_SOUND_AUDIO_CONTEXT',
	{
		providedIn: 'root',
		factory: () => () => {
			const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
			const Context = scope.AudioContext ?? scope.webkitAudioContext;
			return Context ? new Context() : null;
		}
	}
);

/** The notes of the cues: an app may provide its own. */
export const TIMER_SOUND_TONES = new InjectionToken<TimerSoundToneSet>('TIMER_SOUND_TONES', {
	providedIn: 'root',
	factory: () => DEFAULT_TIMER_SOUND_TONES
});

/**
 * Whether the start and stop sounds are on, from the answer of the main process's `app_setting` handler
 * (`{ setting: appSetting, ... }`). Off unless switched on (#7141).
 */
export function isTimerSoundEnabled(appConfig: unknown): boolean {
	return (appConfig as { setting?: { timerStartStopSound?: unknown } } | null)?.setting?.timerStartStopSound === true;
}

/**
 * The start and stop sounds of the time tracker (#7141): a short cue when this computer starts tracking time and
 * when it stops, while the "Play a short sound when the timer starts or stops" setting is on (off by default).
 */
@Injectable({ providedIn: 'root' })
export class TimerSoundService {
	private readonly _electronService = inject(ElectronService);
	private readonly _createContext = inject(TIMER_SOUND_AUDIO_CONTEXT);
	private readonly _tones = inject(TIMER_SOUND_TONES);
	private _context: ITimerSoundOutput | null = null;

	/**
	 * Plays the cues of the timer's ignition changes, from the moment of subscribing.
	 *
	 * @returns The cues, as they are played (or skipped while the setting is off).
	 */
	public watch(ignition$: Observable<ITimerIgnition>): Observable<TimerSoundCue> {
		return ignition$.pipe(
			timerSoundCues(),
			tap((cue) => void this.play(cue))
		);
	}

	/**
	 * Plays a cue if the setting is on. Never throws: a sound is not worth failing a timer for.
	 *
	 * @returns Whether the cue was played.
	 */
	public async play(cue: TimerSoundCue): Promise<boolean> {
		try {
			// Read on each cue, so switching the setting applies at once, from any window
			if (!isTimerSoundEnabled(await this._electronService.invoke('app_setting'))) {
				return false;
			}
			const tones = this._tones[cue];
			const context = await this.context();
			if (!context || !tones?.length) {
				return false;
			}
			scheduleTones(context, tones, TIMER_SOUND_VOLUME);
			return true;
		} catch (error) {
			console.warn(`Could not play the timer ${cue} sound`, error);
			return false;
		}
	}

	/** The audio context, created on the first cue and kept: a page may only open a few. */
	private async context(): Promise<ITimerSoundOutput | null> {
		this._context ??= this._createContext();
		if (this._context?.state === 'suspended' && this._context.resume) {
			await this._context.resume();
		}
		return this._context;
	}
}
