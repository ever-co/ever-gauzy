import { TimerService, ISequence, KbMouseActivityService, ScreenshotService, ScreenshotTO } from '@gauzy/desktop-lib';
import { ITimeslotQueuePayload, ITimerCallbackPayload, IScreenshotQueuePayload } from "@gauzy/desktop-activity";
import { getAuthConfig } from '../util';
import * as moment from 'moment';

const SYNC_INTERVAL = 15 * 60;

export class SyncManager {
	private currentTimerSync: number;
	private timerService: TimerService;
	private screenshotService: ScreenshotService;
	private kbMouseActivityService: KbMouseActivityService;
	private enqueueTimer: (paylod: ITimerCallbackPayload) => void;
	private enqueueTimeSlot: (payload: ITimeslotQueuePayload) => void;
	private enqueueScreenshot: (payload: IScreenshotQueuePayload) => void;
	constructor() {
		this.timerService = new TimerService();
		this.screenshotService = new ScreenshotService();
		this.currentTimerSync = 0;
		this.kbMouseActivityService = new KbMouseActivityService();
	}

	public setQueueCallback(
		enqueueTimer: (paylod: ITimerCallbackPayload) => void,
		enqueueTimeSlot: (payload: ITimeslotQueuePayload) => void,
		enqueueScreenshot: (payload: IScreenshotQueuePayload) => void
	) {
		this.enqueueTimer = enqueueTimer;
		this.enqueueTimeSlot = enqueueTimeSlot;
		this.enqueueScreenshot = enqueueScreenshot;
	}

	public async tickHandler() {
		this.currentTimerSync = (this.currentTimerSync || 0) + 1;
		if (this.currentTimerSync >= SYNC_INTERVAL) {
			this.currentTimerSync = 0;
			await this.checkUnsyncTimer();
			await this.checkUnsyncTimeSlot();
			await this.checkUnsyncScreenshot();
		}
	}

	async checkUnsyncTimer() {
		const timer = await this.timerService.findToSynced();
		const timerOffline = timer.filter((t) => t.timer.isStartedOffline || t.timer.isStoppedOffline);

		if (timerOffline.length) {
			await this.syncTimer(timerOffline);
		}
	}

	async syncTimer(sequences: ISequence[]) {
		for (const sequence of sequences) {
			const { timer } = sequence;
			this.enqueueTimer({
				attempts: 1,
				isRetry: true,
				queue: 'timer_retry',
				timerId: timer?.id,
				data: {
					startedAt: moment(timer.startedAt).toISOString(),
					...(timer.stoppedAt ? { stoppedAt: moment(timer.stoppedAt).toISOString(), isStopped: true } : { stoppedAt: null })
				}
			});
		}
	}

	private async checkUnsyncTimeSlot() {
		const authConfig = getAuthConfig();
		const activities = await this.kbMouseActivityService.findUnsyncActivity(
			authConfig?.user?.id,
			authConfig?.user?.employee?.organizationId,
			authConfig?.user?.employee?.tenantId
		)
		for (const activity of activities) {
			this.enqueueTimeSlot({
				attempts: 1,
				activityId: Number(activity?.id),
				isRetry: true,
				queue: 'time_slot_retry',
				data: {
					timeStart: moment(activity.timeStart).toISOString(),
					timeEnd: moment(activity.timeEnd).toISOString(),
					afkDuration: activity.afkDuration
				}
			})
		}
	}

	private async checkUnsyncScreenshot() {
		const screenshots: ScreenshotTO[] = await this.screenshotService.findUnsyncScreenshot();
		if (screenshots.length) {
			for (const screenshot of screenshots) {
				this.enqueueScreenshot({
					attempts: 1,
					isRetry: true,
					queue: 'screenshot_retry',
					screenshotId: screenshot.imagePath,
					data: {
						imagePath: screenshot.imagePath,
						timeSlotId: screenshot.timeslotId,
						recordedAt: moment(screenshot.recordedAt).toISOString(),
						activityId: screenshot?.activityId
					}
				})
			}
		}
	}

	public async imidietlyCheck() {
		setTimeout(async () => {
			await this.checkUnsyncTimer();
			await this.checkUnsyncTimeSlot();
			await this.checkUnsyncScreenshot();
		}, 5000);
	}


}
