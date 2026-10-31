import * as path from 'path';
import {
	isInsideDirectory,
	resolveScreenshotSound,
	SCREENSHOT_SOUND_EXTENSIONS,
	screenshotSoundExtension
} from './screenshot-sound';

/**
 * The Desktop Timer played the bundled snapshot sound only (#6715): a sound chosen on the computer is now played
 * instead, as long as it is usable, and the bundled sound otherwise.
 */
describe('resolveScreenshotSound', () => {
	const directory = path.resolve('/user-data/sounds');
	const bundled = path.resolve('/app/data/sound/snapshot-sound.wav');
	const custom = { path: path.join(directory, 'screenshot-sound-1.mp3'), name: 'chime.mp3' };
	const exists = (files: string[]) => (file: string) => files.includes(file);

	it('plays the custom sound while its copy exists', () => {
		expect(resolveScreenshotSound(custom, bundled, { directory, exists: exists([custom.path]) })).toBe(custom.path);
	});

	it('plays the bundled sound when no custom sound is set', () => {
		for (const sound of [null, undefined, {}]) {
			expect(resolveScreenshotSound(sound, bundled, { directory, exists: () => true })).toBe(bundled);
		}
	});

	it('plays the bundled sound, not silence, once the custom copy is gone', () => {
		expect(resolveScreenshotSound(custom, bundled, { directory, exists: exists([bundled]) })).toBe(bundled);
	});

	it('only plays files of the app sounds folder, whatever the settings say', () => {
		const elsewhere = [
			path.resolve('/home/user/Music/chime.mp3'),
			path.join(directory, '..', 'secrets.wav'),
			directory
		];
		for (const file of elsewhere) {
			expect(resolveScreenshotSound({ path: file, name: 'x' }, bundled, { directory, exists: () => true })).toBe(
				bundled
			);
		}
	});

	it('only plays supported audio files', () => {
		const script = { path: path.join(directory, 'screenshot-sound-1.exe'), name: 'x.exe' };

		expect(resolveScreenshotSound(script, bundled, { directory, exists: () => true })).toBe(bundled);
	});

	it('ignores a damaged setting', () => {
		expect(resolveScreenshotSound({ path: 42 as any, name: 'x' }, bundled, { directory, exists: () => true })).toBe(
			bundled
		);
	});
});

describe('screenshotSoundExtension', () => {
	it('accepts wav, mp3 and ogg, whatever their case', () => {
		expect(SCREENSHOT_SOUND_EXTENSIONS).toEqual(['wav', 'mp3', 'ogg']);
		expect(screenshotSoundExtension('/a/b/Chime.WAV')).toBe('wav');
		expect(screenshotSoundExtension('C:\\Music\\ding.mp3')).toBe('mp3');
		expect(screenshotSoundExtension('beep.ogg')).toBe('ogg');
	});

	it('refuses anything else', () => {
		for (const file of ['notes.txt', 'song.flac.exe', 'wav', '', 'archive.mp3.zip']) {
			expect(screenshotSoundExtension(file)).toBeNull();
		}
	});
});

describe('isInsideDirectory', () => {
	const directory = path.resolve('/data/sounds');

	it('is true for a file of the folder or of a subfolder', () => {
		expect(isInsideDirectory(path.join(directory, 'a.wav'), directory)).toBe(true);
		expect(isInsideDirectory(path.join(directory, 'sub', 'a.wav'), directory)).toBe(true);
	});

	it('is false for the folder itself, a sibling, or a path climbing out', () => {
		expect(isInsideDirectory(directory, directory)).toBe(false);
		expect(isInsideDirectory(path.resolve('/data/sounds-old/a.wav'), directory)).toBe(false);
		expect(isInsideDirectory(path.join(directory, '..', '..', 'a.wav'), directory)).toBe(false);
	});
});
