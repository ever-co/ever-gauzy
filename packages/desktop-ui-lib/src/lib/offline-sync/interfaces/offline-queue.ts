import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable, Subject, } from 'rxjs';
import { IQueue } from './iqueue';
import { LinkedList } from '../concretes/linked-list';
import { QueueState } from './queue-state';

@UntilDestroy({ checkProperties: true })
export abstract class OfflineQueue<T> implements IQueue<T> {
	private _queue: LinkedList<T>;
	private _queueChanged$: Subject<QueueState<T>>;
	private _state: QueueState<T>;

	constructor() {
		this._queue = new LinkedList<T>();
		this._queueChanged$ = new Subject();
	}

	public abstract synchronize(data: T): Promise<void>;
	public abstract process(): Promise<void>;

	public enqueue(data: T): void {
		this.state.enqueue(data);
		this.notifyState();
	}

	public async dequeue(): Promise<void> {
		await this.state.dequeue();
		this.notifyState();
	}

	public isEmpty(): boolean {
		return this._queue.isEmpty();
	}

	public get state$(): Observable<QueueState<T>> {
		return this._queueChanged$.asObservable();
	}

	public get queue(): LinkedList<T> {
		return this._queue;
	}

	public get state(): QueueState<T> {
		return this._state;
	}

	public set state(value: QueueState<T>) {
		this._state = value;
	}

	private notifyState() {
		this._queueChanged$.next(this.state);
	}
}
