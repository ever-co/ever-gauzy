import { ipcMain } from 'electron';
import { TimerService, TimerTO } from './offline/index';
export class CleanTimer {
	static instance: CleanTimer;
	readonly timerService: TimerService;

	constructor() {
		this.timerService = new TimerService();
		ipcMain.handle('check-unfinished-sync', async () => {
			const unsyncTimer = await this.timerService.findUnfinishedSync();
			return unsyncTimer;
		});

		ipcMain.handle('set-to-offline', async (_, arg: TimerTO[]) => {
			for (const timer of arg) {
				await this.timerService.update({
					id: timer.id,
					synced: false,
					isStoppedOffline: true
				});
			}
		});
	}

	getInstance(): CleanTimer {
		if (!CleanTimer.instance) {
			CleanTimer.instance = new CleanTimer();
		}
		return CleanTimer.instance;
	}
}
