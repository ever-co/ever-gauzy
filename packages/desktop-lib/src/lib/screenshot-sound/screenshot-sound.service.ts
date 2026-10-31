import { DesktopScreenshotSoundError, IDesktopScreenshotSound, IDesktopScreenshotSoundResult } from '@gauzy/contracts';
import { randomUUID } from 'crypto';
import { app, BrowserWindow, dialog, OpenDialogOptions, WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { LocalStore } from '../desktop-store';
import {
	isInsideDirectory,
	resolveScreenshotSound,
	SCREENSHOT_SOUND_EXTENSIONS,
	SCREENSHOT_SOUND_MAX_BYTES,
	screenshotSoundExtension
} from './screenshot-sound';

/** The texts of the file dialog, translated by the settings page (the main process may lack its language). */
export interface IScreenshotSoundDialogLabels {
	title?: string;
	filterName?: string;
}

/** The folder, inside the app's data folder, that keeps the custom screenshot sound of this computer. */
export function screenshotSoundDirectory(): string {
	return path.join(app.getPath('userData'), 'sounds');
}

/** The custom screenshot sound stored in the settings, `null` for the bundled sound. */
export function getCustomScreenshotSound(): IDesktopScreenshotSound | null {
	return LocalStore.getStore('appSetting')?.customScreenshotSound ?? null;
}

/** The sound to play when a screenshot is taken: the custom one while usable, `defaultPath` otherwise. */
export function resolveScreenshotSoundPath(defaultPath: string): string {
	return resolveScreenshotSound(getCustomScreenshotSound(), defaultPath, {
		directory: screenshotSoundDirectory(),
		exists: fs.existsSync
	});
}

/**
 * Asks the page of `target` to play the screenshot sound (its `play_sound` listener), unless the sound is muted in the
 * settings: the custom sound chosen on this computer, or the bundled `defaultPath`. Never throws: a sound is not worth
 * failing a screenshot for.
 */
export function playScreenshotSound(
	target: { webContents?: Pick<WebContents, 'send'> } | null | undefined,
	defaultPath: string
): void {
	try {
		const setting = LocalStore.getStore('appSetting');
		if (!setting || setting.mutedNotification) {
			return;
		}
		const soundFile = resolveScreenshotSoundPath(defaultPath);
		if (soundFile && fs.existsSync(soundFile)) {
			target?.webContents?.send('play_sound', { soundFile });
		}
	} catch (error) {
		console.error('Could not play the screenshot sound', error);
	}
}

/**
 * Uses a copy of `sourcePath` as the screenshot sound of this computer from now on.
 *
 * The file is copied into the app's sounds folder under a new name (so the original may be moved or deleted, and a
 * renderer that cached the previous sound by its path does not replay it), then the previous copy is deleted.
 * Nothing changes when the file is refused.
 */
export function importScreenshotSound(sourcePath: string): IDesktopScreenshotSoundResult {
	const current = getCustomScreenshotSound();
	const extension = screenshotSoundExtension(sourcePath);
	if (!extension) {
		return { sound: current, error: DesktopScreenshotSoundError.UNSUPPORTED };
	}
	let copy: string | null = null;
	let saved = false;
	try {
		const stats = fs.statSync(sourcePath);
		if (!stats.isFile()) {
			return { sound: current, error: DesktopScreenshotSoundError.FAILED };
		}
		if (stats.size > SCREENSHOT_SOUND_MAX_BYTES) {
			return { sound: current, error: DesktopScreenshotSoundError.TOO_LARGE };
		}

		const directory = screenshotSoundDirectory();
		fs.mkdirSync(directory, { recursive: true });
		copy = path.join(directory, `screenshot-sound-${randomUUID()}.${extension}`);
		fs.copyFileSync(sourcePath, copy);

		const sound: IDesktopScreenshotSound = { path: copy, name: path.basename(sourcePath) };
		LocalStore.updateApplicationSetting({ customScreenshotSound: sound });
		saved = true;
		if (current?.path !== copy) {
			removeSoundCopy(current);
		}
		return { sound };
	} catch (error) {
		console.error('Could not use the file as the screenshot sound', error);
		// The settings were not changed: a copy made for them would be left over
		if (copy && !saved) {
			removeSoundCopy({ path: copy, name: '' });
		}
		return { sound: current, error: DesktopScreenshotSoundError.FAILED };
	}
}

/**
 * Asks for a sound file and uses a copy of it as the screenshot sound (see {@link importScreenshotSound}).
 *
 * @param window The window the file dialog belongs to (the settings window).
 * @param labels The dialog's translated texts.
 */
export async function chooseScreenshotSound(
	window?: BrowserWindow | null,
	labels: IScreenshotSoundDialogLabels = {}
): Promise<IDesktopScreenshotSoundResult> {
	const options: OpenDialogOptions = {
		title: dialogLabel(labels.title, 'Choose a screenshot sound'),
		properties: ['openFile'],
		filters: [{ name: dialogLabel(labels.filterName, 'Sound files'), extensions: [...SCREENSHOT_SOUND_EXTENSIONS] }]
	};
	const { canceled, filePaths } = window
		? await dialog.showOpenDialog(window, options)
		: await dialog.showOpenDialog(options);
	if (canceled || !filePaths?.length) {
		return { sound: getCustomScreenshotSound(), canceled: true };
	}
	return importScreenshotSound(filePaths[0]);
}

/** Goes back to the bundled screenshot sound, and deletes the copy of the custom one. */
export function resetScreenshotSound(): IDesktopScreenshotSoundResult {
	const current = getCustomScreenshotSound();
	LocalStore.updateApplicationSetting({ customScreenshotSound: null });
	removeSoundCopy(current);
	return { sound: null };
}

/** Deletes a custom sound's copy: only ever a file of the app's sounds folder. */
function removeSoundCopy(sound: IDesktopScreenshotSound | null): void {
	const file = sound?.path;
	if (typeof file !== 'string' || !isInsideDirectory(file, screenshotSoundDirectory())) {
		return;
	}
	try {
		fs.rmSync(file, { force: true });
	} catch (error) {
		console.warn('Could not delete the previous screenshot sound', error);
	}
}

/** A dialog text sent by the page: a short string, or the English default. */
function dialogLabel(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
}
