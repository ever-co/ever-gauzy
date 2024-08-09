import { ITimeSlot } from '@gauzy/contracts';
import { asapScheduler, concatMap, defer, of, repeat, timer as synchronizer } from 'rxjs';
import { BACKGROUND_SYNC_OFFLINE_INTERVAL } from '../../constants/app.constants';
import { ElectronService } from '../../electron/services';
import { ErrorHandlerService, Store } from '../../services';
import { TimeTrackerStatusService } from '../../time-tracker/time-tracker-status/time-tracker-status.service';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';
import { OfflineQueue } from '../interfaces/offline-queue';
import { TimeSlotQueueService } from '../time-slot-queue.service';
import { BlockedSequenceState, CompletedSequenceState, InProgressSequenceState } from './states';
import { TimeSlotQueue } from './time-slot-queue';

export interface ISequence {
	timer: any;
	intervals: ITimeSlot[];
}

/**
 * SequenceQueue
 */
export class SequenceQueue extends OfflineQueue<ISequence> {
	constructor(
		protected _electronService: ElectronService,
		protected _errorHandlerService: ErrorHandlerService,
		protected _store: Store,
		protected _timeSlotQueueService: TimeSlotQueueService,
		protected _timeTrackerService: TimeTrackerService,
		protected _timeTrackerStatusService: TimeTrackerStatusService
	) {
		super();
		this.state = new BlockedSequenceState(this);
	}

	public async synchronize({ timer, intervals }: ISequence): Promise<void> {
		try {
			console.log('🛠 - Preprocessing time slot');
			const params = {
				note: timer.note,
				organizationContactId: timer.organizationContactId,
				organizationTeamId: timer.organizationTeamId,
				taskId: timer.taskId,
				projectId: timer.projectId,
				organizationId: this._store.organizationId,
				tenantId: this._store.tenantId
			};

			let latest = null;

			if (timer.isStartedOffline) {
				console.log('⏱ - Silent start');
				latest = await this._timeTrackerService.toggleApiStart({
					...timer,
					...params
				});
			}

			console.log('🛠 - Create queue');

			// Create the queue
			const timeSlotQueue = new TimeSlotQueue(
				this._timeTrackerService,
				this._timeSlotQueueService,
				this._electronService,
				this._store
			);

			// append data to queue;
			if (intervals.length > 0) {
				for (const interval of intervals) timeSlotQueue.enqueue(interval);
				intervals = []; // empty the array
				console.log('🏗 - Begin processing time slot queue');
				// Begin processing
				await timeSlotQueue.process();
				console.log('✅ - End processing time slot queue');
				// End processing
			}

			if (timer.isStoppedOffline) {
				console.log('⏱ - Silent stop');
				latest = await this._timeTrackerService.toggleApiStop({
					...timer,
					...params
				});
			}

			const status = await this._timeTrackerStatusService.status();

			asapScheduler.schedule(async () => {
				try {
					await this._electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
						lastTimer: latest
							? latest
							: {
									...timer,
									id: status.lastLog.id
							  },
						...timer
					});
					console.log('⏱ - local database updated');
				} catch (error) {
					console.error('🚨 - Error updating local database', error);
					this._errorHandlerService.handleError(error);
				}
			});
		} catch (error) {
			console.error('🚨 - Error processing time slot queue', error);
			this._timeSlotQueueService.viewQueueStateUpdater = {
				size: this.queue.size,
				inProgress: false
			};
		}
	}

	public process(): Promise<void> {
		console.log('🚀 - Sequence processing started');

		return new Promise<void>((resolve) => {
			// Create an observable to process the queue
			const process$ = defer(() => of(true)).pipe(
				concatMap(() => this.dequeue()),
				repeat({
					delay: () => synchronizer(BACKGROUND_SYNC_OFFLINE_INTERVAL)
				})
			);

			console.log('🚀 - Sequence processing observable created');

			// Subscribe to the observable
			const subscription = process$.subscribe({
				next: () => console.log('✅ - Sequence done')
			});

			console.log('🚀 - Sequence processing observable subscribed');

			// Unsubscribe and resolve the promise when the queue is completed
			this.state$.subscribe((state) => {
				console.log('🚀 - Sequence state updated');

				this._timeSlotQueueService.viewQueueStateUpdater = {
					size: this.queue.size,
					inProgress: state instanceof InProgressSequenceState
				};

				if (state instanceof CompletedSequenceState) {
					console.log('🚀 - Sequence processing completed');
					subscription.unsubscribe();
					resolve();
				}
			});
		});
	}
}
