import { Observable } from "rxjs";
import { QueueState } from "./queue-state";

export interface IQueue<T> {
	state$: Observable<QueueState<T>>
	enqueue(data: T): void;
	dequeue(): Promise<void>;
	isEmpty(): boolean;
}
