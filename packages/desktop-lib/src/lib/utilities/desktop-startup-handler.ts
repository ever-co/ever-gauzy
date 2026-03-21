import { app, dialog } from 'electron';
import { LocalStore } from '../desktop-store';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TranslateService } from '../translation';

const DB_FILENAME = 'gauzy.sqlite3';

export async function handleDesktopStartup(): Promise<void> {
	const configs = LocalStore.getStore('configs');
	if (!configs) {
		return;
	}

	if (app.getVersion() !== configs?.version && !configs?.afterUpdate) {
		const isDbExists = localDatabaseExists();
		if (isDbExists) {
			await showPopup();
		}
		return;
	}
}

export function removeOldDatabase(): void {
	try {
		const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
		if (fs.existsSync(dbPath)) {
			fs.unlinkSync(dbPath);
		}
	} catch (err) {
		console.error('[DesktopStartupHandler] Failed to remove old local database:', err);
	}
}

export function localDatabaseExists(): boolean {
	try {
		const dbExists = fs.existsSync(path.join(app.getPath('userData'), DB_FILENAME));
		return dbExists;
	} catch (err) {
		return false;
	}
}

/**
 * Counts unsynced rows in the local SQLite database.
 * Returns { timers: number, intervals: number } where each value is the
 * count of rows that have NOT yet been uploaded to the server.
 * Returns zero counts on any error (e.g., DB not yet initialized).
 */
export async function countUnsyncedData(): Promise<{ timers: number; intervals: number }> {
	try {
		const { ProviderFactory } = await import('../offline/databases');
		const db = ProviderFactory.instance;

		const [timerRow] = await db.connection('timers').count('* as total').where('synced', false);
		const [intervalRow] = await db.connection('intervals').count('* as total').where('synced', false);

		return {
			timers: Number(timerRow?.total ?? 0),
			intervals: Number(intervalRow?.total ?? 0),
		};
	} catch (err) {
		console.warn('[DesktopStartupHandler] Could not query unsynced data count:', err);
		return { timers: 0, intervals: 0 };
	}
}

/**
 * Shows a native Electron dialog asking the user whether to remove
 * the old local database or keep it after a version change is detected.
 *
 * If unsynced data is present, shows a stronger warning.
 *
 * Button index 0 → Remove Database
 * Button index 1 → Keep It
 */
export async function showPopup(): Promise<void> {
	const { timers, intervals } = await countUnsyncedData();
	const hasUnsyncedData = timers > 0 || intervals > 0;

	const titleKey = hasUnsyncedData
		? 'TIMER_TRACKER.DIALOG.DB_CLEANUP_UNSYNCED_TITLE'
		: 'TIMER_TRACKER.DIALOG.DB_CLEANUP_TITLE';

	const messageKey = hasUnsyncedData
		? 'TIMER_TRACKER.DIALOG.DB_CLEANUP_UNSYNCED_MESSAGE'
		: 'TIMER_TRACKER.DIALOG.DB_CLEANUP_MESSAGE';

	const detail = hasUnsyncedData
		? TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_UNSYNCED_DETAIL', { timers, intervals })
		: TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_DETAIL');

	const { response } = await dialog.showMessageBox({
		type: hasUnsyncedData ? 'warning' : 'question',
		title: TranslateService.instant(titleKey),
		message: TranslateService.instant(messageKey),
		detail,
		buttons: [
			TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_REMOVE'),
			TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_KEEP'),
		],
		defaultId: 1,
		cancelId: 1,
		noLink: true,
	});

	if (response === 0) {
		removeOldDatabase();
	}
}

