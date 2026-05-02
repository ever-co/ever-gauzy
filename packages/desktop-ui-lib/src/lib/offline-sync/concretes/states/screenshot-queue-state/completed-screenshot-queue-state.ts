import { QueueState } from '../../../interfaces/queue-state';
import { IScreenshotQueue } from '../../screenshot.queue';
import { InProgressScreenshotState } from './in-progress-screenshot-state';
export class CompletedScreenshotQueueState extends QueueState<IScreenshotQueue> {
	enqueue(data: IScreenshotQueue): void {
		this.context.state = new InProgressScreenshotState(this.context);
		this.context.queue.append(data);
	}

	dequeue(): Promise<void> | void {
		console.log('✅ - Completed');
	}
}
