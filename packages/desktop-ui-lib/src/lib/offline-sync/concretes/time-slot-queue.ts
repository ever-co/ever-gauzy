import { IScreenshot, ITimeSlot } from '@gauzy/contracts';
import { defer, timer, repeat, concatMap, of } from 'rxjs';
import { BACKGROUND_SYNC_OFFLINE_INTERVAL } from '../../constants/app.constants';
import { ElectronService } from '../../electron/services';
import { Store } from '../../services';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';
import { OfflineQueue } from '../interfaces/offline-queue';
import { TimeSlotQueueService } from '../time-slot-queue.service';
import { BlockedTimeSlotState, CompletedTimeSlotState } from './states';

export class TimeSlotQueue extends OfflineQueue<ITimeSlot> {
	constructor(
		private _timeTrackerService: TimeTrackerService,
		private _timeSlotQueueService: TimeSlotQueueService,
		private _electronService: ElectronService,
		private _store: Store
	) {
		super();
		this.state = new BlockedTimeSlotState(this);
	}
	public async synchronize(interval: ITimeSlot): Promise<void> {
		const screenshots = interval.screenshots;
		console.log('prepare backup', interval);
		const activities: any = await this._timeTrackerService.pushToTimeSlot({
			...interval,
			recordedAt: interval.startedAt,
			organizationId: this._store.organizationId,
			tenantId: this._store.tenantId,
		});
		console.log('backup', activities);
		const timeSlotId = activities.id;
		await this._uploadScreenshots(screenshots, interval, timeSlotId);
		await this._electronService.ipcRenderer.invoke(
			'UPDATE_SYNCED',
			{ ...interval, remoteId: timeSlotId }
		)
		this._timeSlotQueueService.updater = { ...interval, timeSlotId };
	}

	// upload screenshot to timeslot api
	private async _uploadScreenshots(
		screenshots: IScreenshot[],
		interval: ITimeSlot,
		timeSlotId: string
	): Promise<void> {
		try {
			await Promise.all(
				screenshots.map(async (screenshot) => {
					try {
						const resImg =
							await this._timeTrackerService.uploadImages(
								{
									...interval,
									recordedAt: interval.startedAt,
									timeSlotId,
								},
								{
									b64Img: screenshot.b64img,
									fileName: screenshot.fileName,
								}
							);
						console.log('Result upload', resImg);
						return resImg;
					} catch (error) {
						console.log('On upload Image', error);
					}
				})
			);
		} catch (error) {
			console.log('Backup-error', error);
		}
	}

	public process(): Promise<void> {
		return new Promise<void>((resolve) => {
			// Create an observable to process the queue
			const process$ = defer(() => of(true)).pipe(
				concatMap(() => this.dequeue()),
				repeat({
					delay: () => timer(BACKGROUND_SYNC_OFFLINE_INTERVAL),
				})
			);

			// Subscribe to the observable
			const subscription = process$.subscribe({
				next: () => console.log('✅ - Time slot done')
			});

			// Unsubscribe and resolve the promise when the queue is completed
			this.state$.subscribe((state) => {
				console.log('[Subscription]', this.queue.toString());
				if (state instanceof CompletedTimeSlotState) {
					subscription.unsubscribe();
					resolve();
				}
			});
		});
	}
}
