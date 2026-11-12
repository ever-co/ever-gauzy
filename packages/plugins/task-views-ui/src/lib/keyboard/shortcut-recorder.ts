import { chordOfEvent, ShortcutBinding, ShortcutChord } from './shortcut-registry';

/** What a key press did to a recording. */
export type RecorderStep =
	| { state: 'recording'; binding: ShortcutBinding }
	| { state: 'done'; binding: ShortcutBinding }
	| { state: 'cancelled' }
	| { state: 'ignored' };

/**
 * Records a binding from key presses: one chord, or two in a row (a sequence, `G` then `T`) when the second comes
 * within the wait. Esc alone cancels; a modifier alone is ignored. Pure apart from the clock it is given, so the
 * settings page and the specs drive it the same way.
 */
export class ShortcutRecorder {
	private chords: ShortcutChord[] = [];
	private lastAt = 0;

	constructor(
		private readonly maxChords = 2,
		private readonly waitMs = 1_200,
		private readonly now: () => number = () => Date.now(),
		/** The platform the keys are read for (⌘ is `mod` on a Mac, Ctrl elsewhere); absent, either is. */
		private readonly platform?: 'mac' | 'other'
	) {}

	/** The chords recorded so far. */
	get binding(): ShortcutBinding {
		return [...this.chords];
	}

	/** Starts over. */
	reset(): void {
		this.chords = [];
		this.lastAt = 0;
	}

	/** Takes one key press. */
	press(event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): RecorderStep {
		const chord = chordOfEvent(event, this.platform);
		if (!chord) return { state: 'ignored' };
		if (chord.key === 'escape' && !chord.mod && !chord.alt && !chord.shift) {
			this.reset();
			return { state: 'cancelled' };
		}
		const at = this.now();
		if (this.chords.length && at - this.lastAt > this.waitMs) this.chords = [];
		this.chords.push(chord);
		this.lastAt = at;
		// A chord with ⌘/Ctrl or Alt is never the start of a sequence: it is the whole binding.
		if (this.chords.length >= this.maxChords || chord.mod || chord.alt) {
			const binding = this.binding;
			this.reset();
			return { state: 'done', binding };
		}
		return { state: 'recording', binding: this.binding };
	}

	/** The wait ran out: what was recorded is the binding (nothing recorded is a cancel). */
	timeout(): RecorderStep {
		const binding = this.binding;
		this.reset();
		return binding.length ? { state: 'done', binding } : { state: 'cancelled' };
	}
}
