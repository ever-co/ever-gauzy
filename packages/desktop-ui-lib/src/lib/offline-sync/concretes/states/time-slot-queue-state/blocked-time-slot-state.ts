import { ITimeSlot } from '@gauzy/contracts';
import { InProgressTimeSlotState } from '.';
import { QueueState } from '../../../interfaces/queue-state';

export class BlockedTimeSlotState extends QueueState<ITimeSlot> {
	public enqueue(data: ITimeSlot): void {
		if (this.context.isEmpty()) {
			this.context.state = new InProgressTimeSlotState(this.context);
		}
		this.context.queue.append(data);
	}
	public dequeue(): void {
		console.log('⭕️ - blocked');
	}
}
