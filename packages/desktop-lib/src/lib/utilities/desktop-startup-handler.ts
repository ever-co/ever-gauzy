import { app, dialog } from 'electron';
import { LocalStore } from '../desktop-store';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TranslateService } from '../translation';

const DB_FILENAME = 'gauzy.sqlite3';

export async function handleDesktopStartup(): Promise<number> {
	const configs = LocalStore.getStore('configs');
	if (!configs) {
		return 1;
	}

	if (app.getVersion() !== configs?.version && !configs?.afterUpdate) {
		const isDbExists = localDatabaseExists();
		if (isDbExists) {
			const buttonResponse = await showPopup();
			return buttonResponse;
		}
		return 1;
	}
}

export async function removeOldDatabase(): Promise<void> {
	try {
		const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
		if (fs.existsSync(dbPath)) {
			// Destroy active db connections before deleting the file 
			// otherwise we hit 'attempt to write a readonly database'
			const { ProviderFactory } = await import('../offline/databases');
			if (ProviderFactory.instance) {
				await ProviderFactory.instance.kill();
			}

			fs.unlinkSync(dbPath);

			// Clear user authentication and project state from electron-store
			// so that the frontend Angular app boots into a clean logged-out
			// state, matching the now-empty local database.
			LocalStore.updateAuthSetting({
				token: null,
				employeeId: null,
				organizationId: null,
				userId: null,
				tenantId: null,
				refreshToken: null,
				isLogout: true,
			});

			LocalStore.updateConfigProject({
				projectId: null,
				taskId: null,
				note: null,
				organizationContactId: null,
				organizationTeamId: null,
			});
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
 * Returns { timers: -1, intervals: -1 } as a sentinel when the query fails
 * (e.g., DB not yet initialized or schema error) so callers can treat the
 * risk level as unknown rather than falsely reporting zero unsynced rows.
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
		return { timers: -1, intervals: -1 };
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
export async function showPopup(): Promise<number> {
	const { timers, intervals } = await countUnsyncedData();
	// Treat negative sentinel values (-1) as unknown risk — show the stronger
	// warning dialog rather than falsely signalling a safe-to-delete state.
	const isUnknown = timers < 0 || intervals < 0;
	const hasUnsyncedData = isUnknown || timers > 0 || intervals > 0;

	// Always use the primary title and message so the context (app version update) is never lost.
	const titleKey = 'TIMER_TRACKER.DIALOG.DB_CLEANUP_TITLE';
	const messageKey = 'TIMER_TRACKER.DIALOG.DB_CLEANUP_MESSAGE';

	let countsText = '';
	if (hasUnsyncedData && !isUnknown) {
		const parts = [];
		if (timers > 0) parts.push(TranslateService.instant('TIMER_TRACKER.DIALOG.UNSYNCED_TIMERS_COUNT', { count: timers }));
		if (intervals > 0) parts.push(TranslateService.instant('TIMER_TRACKER.DIALOG.UNSYNCED_INTERVALS_COUNT', { count: intervals }));
		countsText = parts.join(' ' + TranslateService.instant('TIMER_TRACKER.DIALOG.AND_JOIN') + ' ');
	}

	const detail = isUnknown
		? TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_UNKNOWN_DETAIL')
		: hasUnsyncedData
		? TranslateService.instant('TIMER_TRACKER.DIALOG.DB_CLEANUP_UNSYNCED_DETAIL', { countsText })
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
		await removeOldDatabase();
	}
	return response;
}

