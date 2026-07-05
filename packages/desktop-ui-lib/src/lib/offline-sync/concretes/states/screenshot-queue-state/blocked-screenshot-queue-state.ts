import { QueueState } from '../../../interfaces/queue-state';
import { IScreenshotQueue } from '../../screenshot.queue';
import { InProgressScreenshotState } from './in-progress-screenshot-state';
export class BlockedScreenshotQueueState extends QueueState<IScreenshotQueue> {
	public enqueue(data: IScreenshotQueue): void {
		if (this.context.isEmpty()) {
			this.context.state = new InProgressScreenshotState(this.context);
		}
		this.context.queue.append(data);
	}

	public dequeue(): void {
		console.log('⭕️ - blocked');
	}
}
