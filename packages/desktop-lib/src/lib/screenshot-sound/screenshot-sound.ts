import { IDesktopScreenshotSound } from '@gauzy/contracts';
import * as path from 'path';

/** The audio formats a custom screenshot sound may have (all played by Chromium). */
export const SCREENSHOT_SOUND_EXTENSIONS: readonly string[] = ['wav', 'mp3', 'ogg'];

/** The largest custom screenshot sound accepted: far more than a short notification sound needs. */
export const SCREENSHOT_SOUND_MAX_BYTES = 10 * 1024 * 1024;

/** The supported audio extension of a file (lower case, without the dot), `null` for any other file. */
export function screenshotSoundExtension(filePath: string): string | null {
	const extension = path
		.extname(filePath ?? '')
		.slice(1)
		.toLowerCase();
	return SCREENSHOT_SOUND_EXTENSIONS.includes(extension) ? extension : null;
}

/** Whether `filePath` is inside `directory` (not the directory itself, not next to it through `..`). */
export function isInsideDirectory(filePath: string, directory: string): boolean {
	const relative = path.relative(path.resolve(directory), path.resolve(filePath));
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * The sound to play when a screenshot is taken: the custom sound chosen on this computer while it is usable, the
 * bundled sound otherwise.
 *
 * A custom sound is used only when it is a supported audio file inside the app's own sounds folder (where choosing a
 * sound copies it) and still exists: a setting edited by hand, a copy deleted since, or a folder moved, falls back to
 * the bundled sound instead of going silent.
 *
 * @param sound The custom sound stored in the settings, if any.
 * @param defaultPath The bundled sound.
 * @param options.directory The app's sounds folder.
 * @param options.exists Whether a file exists (`fs.existsSync` in the app).
 */
export function resolveScreenshotSound(
	sound: Partial<IDesktopScreenshotSound> | null | undefined,
	defaultPath: string,
	options: { directory: string; exists: (filePath: string) => boolean }
): string {
	const custom = sound?.path;
	if (
		typeof custom === 'string' &&
		screenshotSoundExtension(custom) &&
		isInsideDirectory(custom, options.directory) &&
		options.exists(custom)
	) {
		return custom;
	}
	return defaultPath;
}
