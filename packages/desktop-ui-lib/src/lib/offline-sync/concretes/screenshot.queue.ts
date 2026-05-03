import { OfflineQueue } from '../interfaces/offline-queue';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';
import { Store, AuditLogService } from '../../services';
import { ElectronService } from '../../electron/services';
import { BlockedScreenshotQueueState, CompletedScreenshotQueueState } from './states';
import { defer, of, concatMap, repeat } from 'rxjs';
import { BACKGROUND_SYNC_OFFLINE_INTERVAL } from '../../constants/app.constants';
export interface IScreenshotQueue {
	id: number;
	timeslotId: string;
	base64Image: string;
	recordedAt: Date;
	retries: number;
}

export class ScreenshotQueue extends OfflineQueue<IScreenshotQueue> {
	constructor(
		private readonly _timeTrackerService: TimeTrackerService,
		private readonly _store: Store,
		private readonly _auditLogService: AuditLogService,
		private readonly _electronService: ElectronService
	) {
		super();
		this.state = new BlockedScreenshotQueueState(this);
	}

	public async synchronize(item: IScreenshotQueue): Promise<void> {
		if (!item.timeslotId || !item.base64Image) {
			return;
		}
		try {
			item.retries = item.retries || 0;
			if (item.retries >= 3) {
				await this._electronService.invoke('UPDATE_SCREENSHOT_SYNC_STATUS', {
					id: item.id,
					remove: true
				});
				return;
			}
			const timeSlot = await this._timeTrackerService.getTimeSlot({ timeSlotId: item.timeslotId });
			if (timeSlot?.id) {
				const resultImg = await this._timeTrackerService.uploadImages(
					{
						tenantId: this._store.tenantId,
						organizationId: this._store.organizationId,
						timeSlotId: item.timeslotId,
						recordedAt: new Date(item.recordedAt)
					},
					{
						b64Img: item.base64Image,
						fileName: `screenshot-${(new Date(item.recordedAt)).getTime()}.png`
					}
				);

				if (resultImg?.id && resultImg?.thumbUrl) {
					this._auditLogService.screenshotLogInfo(`Retry screenshot upload Successfully uploaded screenshot for timeslot ${item.timeslotId} at ${item.recordedAt}`);
					await this._electronService.invoke('UPDATE_SCREENSHOT_SYNC_STATUS', {
						id: item.id,
						synced: true
					});
				} else {
					this._auditLogService.screenshotLogError(`Retry screenshot upload Failed to upload screenshot for timeslot ${item.timeslotId} at ${item.recordedAt}. No valid response from server.`);
					await this._electronService.invoke('UPDATE_SCREENSHOT_SYNC_STATUS', {
						id: item.id,
						synced: false,
						remove: false,
						failedReason: JSON.stringify(resultImg)
					});
				}
			} else {
				await this._electronService.invoke('UPDATE_SCREENSHOT_SYNC_STATUS', {
					id: item.id,
					synced: false,
					remove: true,
					failedReason: 'Associated time slot not found'
				});
			}
		} catch (error) {
			this._auditLogService.screenshotLogError(`Retry screenshot upload Failed uploading screenshot for timeslot ${item.timeslotId} at ${item.recordedAt}. Error: ${typeof error?.message === 'string' ? error.message : JSON.stringify(error?.message ?? error)}`);
			await this._electronService.invoke('UPDATE_SCREENSHOT_SYNC_STATUS', {
				id: item.id,
				synced: false,
				remove: false,
				failedReason: typeof error?.message === 'string' ? error.message : JSON.stringify(error?.message ?? error)
			});
		}

	}

	public process(): Promise<void> {
		return new Promise<void>((resolve) => {
			// create observable for queue
			const process$ = defer(() => of(true)).pipe(
				concatMap(() => this.dequeue()),
				repeat({ delay: BACKGROUND_SYNC_OFFLINE_INTERVAL })
			)

			const subscription = process$.subscribe({
				next: () => { console.log('Screenshot Sync Done'); },
			})

			const stateSubscription = this.state$.subscribe((state) => {
				if (state instanceof CompletedScreenshotQueueState) {
					subscription.unsubscribe();
					stateSubscription.unsubscribe();
					resolve();
				}
			})
		})
	}
}
