import { ISequence } from './sequence-queue';
import { SequenceQueue } from './sequence-queue';
import { Store } from '../../services/store.service';
import { TimeSlotQueue } from '.';
import { TimeSlotQueueService } from '..';
import { ElectronService } from '../../electron/services';
import { ErrorHandlerService } from '../../services';
import { TimeTrackerStatusService } from '../../time-tracker/time-tracker-status/time-tracker-status.service';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';

export class InterruptedSequenceQueue extends SequenceQueue {
	constructor(
		protected _electronService: ElectronService,
		protected _errorHandlerService: ErrorHandlerService,
		protected _store: Store,
		protected _timeSlotQueueService: TimeSlotQueueService,
		protected _timeTrackerService: TimeTrackerService,
		protected _timeTrackerStatusService: TimeTrackerStatusService
	) {
		super(
			_electronService,
			_errorHandlerService,
			_store,
			_timeSlotQueueService,
			_timeTrackerService,
			_timeTrackerStatusService
		);
	}

	public async synchronize({ timer, intervals }: ISequence): Promise<void> {
		console.log('🛠 - Create queue');
		// Create the queue
		const timeSlotQueue = new TimeSlotQueue(
			this._timeTrackerService,
			this._timeSlotQueueService,
			this._electronService,
			this._store
		);
		// append data to queue;
		for (const interval of intervals)
			timeSlotQueue.enqueue({
				...interval,
				timesheetId: timer.timesheetId
			});
		intervals = []; // empty the array
		console.log('🏗 - Begin processing interrupted time slot queue');
		// Begin processing
		await timeSlotQueue.process();
		console.log('✅ - End processing interrupted time slot queue');
		// End processing
	}
}
