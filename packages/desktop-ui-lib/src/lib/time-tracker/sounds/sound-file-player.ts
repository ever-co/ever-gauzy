/** The part of an audio element the player needs. */
export type ISoundFileAudio = Pick<HTMLAudioElement, 'play' | 'pause'>;

/**
 * Plays a sound file, such as the screenshot sound the main process asks for (`play_sound`).
 *
 * It keeps one audio element and makes a new one when the file changes, so a screenshot sound chosen in the settings
 * (#6715) is heard from the next screenshot on, without restarting the app.
 */
export class SoundFilePlayer {
	private _audio: ISoundFileAudio | null = null;
	private _file: string | null = null;

	constructor(private readonly _createAudio: (file: string) => ISoundFileAudio = (file) => new Audio(file)) {}

	/** The file of the current audio element, `null` before the first sound. */
	public get file(): string | null {
		return this._file;
	}

	/**
	 * Plays `file`, or the last file when none is given. A sound still playing goes on, as an audio element does.
	 *
	 * @returns A promise of the start of the sound: rejected when it cannot play, never a synchronous error.
	 */
	public play(file?: string | null): Promise<void> {
		try {
			if (typeof file === 'string' && file && file !== this._file) {
				this._audio?.pause();
				this._audio = this._createAudio(file);
				this._file = file;
			}
			return Promise.resolve(this._audio?.play());
		} catch (error) {
			return Promise.reject(error);
		}
	}
}
