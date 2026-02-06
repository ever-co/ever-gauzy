import { ipcMain } from 'electron';
import { TimerService, TimerTO, Timer } from './offline/index';
export class CleanTimer {
	private static instance: CleanTimer;
	readonly timerService: TimerService;

	private constructor() {
		this.timerService = new TimerService();
		ipcMain.handle('check-unfinished-sync', async () => {
			const unfinishedSyncTimers = await this.timerService.findUnfinishedSync();
			return unfinishedSyncTimers;
		});

		ipcMain.handle('set-to-offline', async (_, arg: TimerTO[]) => {
			for (const timer of arg) {
				await this.timerService.update(new Timer({
					id: timer.id,
					synced: false,
					isStoppedOffline: true
				}));
			}
		});
	}

	static getInstance(): CleanTimer {
		if (!CleanTimer.instance) {
			CleanTimer.instance = new CleanTimer();
		}
		return CleanTimer.instance;
	}
}
