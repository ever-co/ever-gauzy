import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, filter, takeUntil } from 'rxjs';
import { Type } from '@gauzy/common';
import { isNotNullOrUndefined } from '@gauzy/utils';
import { BaseEvent } from './base-event';

@Injectable()
export class EventBus implements OnModuleDestroy {
	private event$: Subject<BaseEvent> = new Subject<BaseEvent>();
	private onDestroy$: Subject<void> = new Subject<void>();

	constructor() {}

	/**
	 * Publishes a single event.
	 * @param event The event to be published.
	 */
	async publish<T extends BaseEvent>(event: T): Promise<void> {
		this.event$.next(event);
	}

	/**
	 * Publishes multiple events in sequence.
	 * @param events The events to be published.
	 */
	async publishMultiple<T extends BaseEvent>(events: T[]): Promise<void> {
		for await (const event of events) {
			this.event$.next(event);
		}
	}

	/**
	 * Subscribes to events of the given type.
	 * @param event The type of events to subscribe to.
	 * @returns An Observable of events with the specified type.
	 */
	ofType<T extends BaseEvent>(event: Type<T>): Observable<T> {
		return this.event$.asObservable().pipe(
			takeUntil(this.onDestroy$), // Unsubscribe when the component is destroyed
			filter((item) => item.constructor === event), //
			filter(isNotNullOrUndefined) //
		) as Observable<T>;
	}

	/**
	 * Lifecycle hook method executed when a module is being destroyed.
	 * It completes the onDestroy$ subject to ensure proper cleanup.
	 */
	onModuleDestroy(): void {
		/**
		 * Sends a completion signal to the onDestroy$ subject.
		 * This is typically used to signal cleanup or completion of asynchronous tasks.
		 */
		this.onDestroy$.next();

		/**
		 * Completes the onDestroy$ subject, marking it as finished.
		 * After completion, the subject will not emit any more values.
		 */
		this.onDestroy$.complete();
	}
}
