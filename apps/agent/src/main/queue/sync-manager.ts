import { TimerService, ISequence, KbMouseActivityService, TimerTO, ScreenshotService, ScreenshotTO } from '@gauzy/desktop-lib';
import { ITimeslotQueuePayload, ITimerCallbackPayload, IScreenshotQueuePayload } from "@gauzy/desktop-activity";
import { getAuthConfig } from '../util';
import * as moment from 'moment';

const SYNC_INTERVAL = 30 * 60;

export class SyncManager {
	private currentTimerSync: number;
	private timerService: TimerService;
	private screenshotService: ScreenshotService;
	private kbMouseActivityService: KbMouseActivityService;
	private enqueueTimer: (paylod: ITimerCallbackPayload) => void;
	private enqueueTimeSlot: (payload: ITimeslotQueuePayload) => void;
	private enqueueScreenshot: (payload: IScreenshotQueuePayload) => void;
	constructor(
		enqueueTimer: (paylod: ITimerCallbackPayload) => void,
		enqueueTimeSlot: (payload: ITimeslotQueuePayload) => void,
		enqueueScreenshot: (payload: IScreenshotQueuePayload) => void
	) {
		this.timerService = new TimerService();
		this.screenshotService = new ScreenshotService();
		this.currentTimerSync = 0;
		this.enqueueTimer = enqueueTimer;
		this.enqueueTimeSlot = enqueueTimeSlot;
		this.enqueueScreenshot = enqueueScreenshot;
		this.kbMouseActivityService = new KbMouseActivityService();
	}

	public tickHandler() {
		console.log('tick handler', this.currentTimerSync);
		this.currentTimerSync = (this.currentTimerSync || 0) + 1;
		if (this.currentTimerSync >= SYNC_INTERVAL) {
			this.currentTimerSync = 0;
			this.checkUnsyncTimer();
			this.checkUnsyncScreenshot();
		}
	}

	async checkUnsyncTimer() {
		const timer = await this.timerService.findToSynced();
		if (timer.length) {
			await this.syncTimer(timer);
		}
		console.log('timer', JSON.stringify(timer, null, 2));
	}

	async syncTimer(sequences: ISequence[]) {
		for (const sequence of sequences) {
			const { timer } = sequence;
			this.enqueueTimer({
				attempts: 1,
				queue: 'timer_retry',
				timerId: timer?.id,
				data: {
					startedAt: moment(timer.startedAt).toISOString(),
					stoppedAt: null
				}
			});
			await this.checkUnsyncTimeSlot(timer);
		}
	}

	private async checkUnsyncTimeSlot(timer: TimerTO) {
		const authConfig = getAuthConfig();
		const activities = await this.kbMouseActivityService.findUnsyncActivity(
			authConfig?.user?.id,
			authConfig?.user?.employee?.organizationId,
			authConfig?.user?.employee?.tenantId,
			timer.id
		)
		for (const activity of activities) {
			this.enqueueTimeSlot({
				attempts: 1,
				activityId: Number(activity?.id),
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
					queue: 'screenshot',
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
		setTimeout(() => {
			this.checkUnsyncTimer();
			this.checkUnsyncScreenshot();
		}, 5000);
	}


}
