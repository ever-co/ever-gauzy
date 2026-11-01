/** The part of an audio element the player needs. */
export type ISoundFileAudio = Pick<HTMLAudioElement, 'play' | 'pause'>;

/** A URL scheme of two letters or more (`file:`, `https:`, `data:`), unlike a Windows drive (`C:`). */
const URL_SCHEME = /^[a-z][a-z\d+.-]+:/i;
/** An absolute Windows path: `C:\…` or `C:/…`. */
const WINDOWS_DRIVE_PATH = /^[a-z]:[\\/]/i;

/**
 * The URL an audio element can load a sound file from. The main process sends file system paths (`play_sound`);
 * as a URL, `#`, `?`, `%` or a space in a folder name would cut or change the path, so each part is encoded:
 * - `C:\Users\J#\sound.mp3` → `file:///C:/Users/J%23/sound.mp3`;
 * - `\\server\share\sound.mp3` → `file://server/share/sound.mp3`;
 * - `/home/j/sound.mp3` → `file:///home/j/sound.mp3`.
 * A URL, or a path relative to the page, is kept as it is.
 */
export function soundFileUrl(file: string): string {
	const encode = (segments: string[]) => segments.map((segment) => encodeURIComponent(segment)).join('/');
	if (URL_SCHEME.test(file)) {
		return file;
	}
	if (WINDOWS_DRIVE_PATH.test(file)) {
		const [drive, ...segments] = file.split(/[\\/]/);
		return `file:///${drive}/${encode(segments)}`;
	}
	if (file.startsWith('\\\\')) {
		const [host, ...segments] = file.slice(2).split(/[\\/]/);
		return `file://${host}/${encode(segments)}`;
	}
	if (file.startsWith('/')) {
		return `file://${encode(file.split('/'))}`;
	}
	return file;
}

/**
 * Plays a sound file, such as the screenshot sound the main process asks for (`play_sound`).
 *
 * It keeps one audio element and makes a new one when the file changes, so a screenshot sound chosen in the settings
 * (#6715) is heard from the next screenshot on, without restarting the app.
 */
export class SoundFilePlayer {
	private _audio: ISoundFileAudio | null = null;
	private _file: string | null = null;

	/** @param _createAudio Makes the audio element of a sound URL (see {@link soundFileUrl}). */
	constructor(private readonly _createAudio: (url: string) => ISoundFileAudio = (url) => new Audio(url)) {}

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
				this._audio = this._createAudio(soundFileUrl(file));
				this._file = file;
			}
			return Promise.resolve(this._audio?.play());
		} catch (error) {
			return Promise.reject(error);
		}
	}
}
