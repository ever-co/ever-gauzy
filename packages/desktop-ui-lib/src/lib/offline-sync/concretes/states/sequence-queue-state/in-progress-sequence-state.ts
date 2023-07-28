import { QueueState } from '../../../interfaces/queue-state';
import { ISequence } from '../../sequence-queue';
import { CompletedSequenceState } from './completed-sequence-state';

export class InProgressSequenceState extends QueueState<ISequence> {
	public enqueue(data: ISequence): void {
		if (this.context.isEmpty()) {
			this.context.state = new InProgressSequenceState(this.context);
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
			? new CompletedSequenceState(this.context)
			: new InProgressSequenceState(this.context);
	}
}
