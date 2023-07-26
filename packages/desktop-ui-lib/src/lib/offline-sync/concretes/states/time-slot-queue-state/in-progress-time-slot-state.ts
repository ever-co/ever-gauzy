import { ITimeSlot } from '@gauzy/contracts';
import { CompletedTimeSlotState } from '.';
import { QueueState } from '../../../interfaces/queue-state';

export class InProgressTimeSlotState extends QueueState<ITimeSlot> {
	public enqueue(data: ITimeSlot): void {
		if (this.context.isEmpty()) {
			this.context.state = new InProgressTimeSlotState(this.context);
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
			? new CompletedTimeSlotState(this.context)
			: new InProgressTimeSlotState(this.context);
	}
}
