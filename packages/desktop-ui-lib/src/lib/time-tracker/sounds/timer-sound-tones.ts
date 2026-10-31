import type { TimerSoundCue } from './timer-sound-cues';

/** One note of a cue. */
export interface ITimerSoundTone {
	/** The pitch, in hertz. */
	frequency: number;
	/** When the note starts, in seconds after the cue starts. */
	offset: number;
	/** How long the note lasts, in seconds. */
	duration: number;
}

/** The notes of each cue. */
export type TimerSoundToneSet = Readonly<Record<TimerSoundCue, readonly ITimerSoundTone[]>>;

/**
 * The cues of the time tracker, synthesized (no audio file, nothing to license): two short notes going up (E5, A5)
 * when tracking starts, going down (A5, D5) when it stops, so the two are told apart without looking.
 */
export const DEFAULT_TIMER_SOUND_TONES: TimerSoundToneSet = {
	start: [
		{ frequency: 659.25, offset: 0, duration: 0.12 },
		{ frequency: 880, offset: 0.12, duration: 0.16 }
	],
	stop: [
		{ frequency: 880, offset: 0, duration: 0.12 },
		{ frequency: 587.33, offset: 0.12, duration: 0.18 }
	]
};

/** The loudness of the cues (0 to 1): a discreet sound, under the level of the screenshot sound. */
export const TIMER_SOUND_VOLUME = 0.15;

/** The part of the Web Audio API the tones need. */
export type ITimerSoundAudioContext = Pick<
	BaseAudioContext,
	'currentTime' | 'destination' | 'createOscillator' | 'createGain'
>;

/** The lowest gain of an envelope: an exponential ramp cannot reach 0. */
const SILENCE = 0.0001;
/** The time a note takes to reach its volume, short enough to sound immediate, long enough not to click. */
const ATTACK_SECONDS = 0.01;

/**
 * Plays notes on an audio context: a sine wave each, with a short fade in and out.
 *
 * @returns When the last note ends, in the context's time.
 */
export function scheduleTones(
	context: ITimerSoundAudioContext,
	tones: readonly ITimerSoundTone[],
	volume = TIMER_SOUND_VOLUME
): number {
	const start = context.currentTime;
	const peak = Math.min(Math.max(volume, SILENCE), 1);
	let end = start;

	for (const tone of tones) {
		const begin = start + Math.max(tone.offset, 0);
		const finish = begin + Math.max(tone.duration, ATTACK_SECONDS * 2);

		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(tone.frequency, begin);
		gain.gain.setValueAtTime(SILENCE, begin);
		gain.gain.exponentialRampToValueAtTime(peak, begin + ATTACK_SECONDS);
		gain.gain.exponentialRampToValueAtTime(SILENCE, finish);

		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.onended = () => {
			oscillator.disconnect();
			gain.disconnect();
		};
		oscillator.start(begin);
		oscillator.stop(finish);

		end = Math.max(end, finish);
	}
	return end;
}
