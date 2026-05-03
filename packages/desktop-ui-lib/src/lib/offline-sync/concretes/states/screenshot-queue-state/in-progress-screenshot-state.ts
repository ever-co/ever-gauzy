import { QueueState } from '../../../interfaces/queue-state';
import { IScreenshotQueue } from '../../screenshot.queue';
import { CompletedScreenshotQueueState } from './completed-screenshot-queue-state';
export class InProgressScreenshotState extends QueueState<IScreenshotQueue> {
	public enqueue(data: IScreenshotQueue): void {
		if (this.context.isEmpty()) {
			this.context.state = new InProgressScreenshotState(this.context);
		}
		this.context.queue.append(data);
	}

	public async dequeue(): Promise<void> {
		if (this.context.isEmpty()) {
			return;
		}
		const shifted = this.context.queue.shift().data;
		if (shifted) {
			await this.context.synchronize(shifted);
		}
		this.context.state = this.context.isEmpty()
			? new CompletedScreenshotQueueState(this.context)
			: new InProgressScreenshotState(this.context);
	}
}
