import { OfflineQueue } from './offline-queue';

export abstract class QueueState<T> {
	protected context: OfflineQueue<T>;
	constructor(queue: OfflineQueue<T>) {
		this.context = queue;
	}
	abstract enqueue(data: T): void;
	abstract dequeue(): Promise<void> | void;
}
