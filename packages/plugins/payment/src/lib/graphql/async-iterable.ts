import { Observable } from 'rxjs';

/**
 * Adapts a platform event stream to the async iterable a GraphQL subscription must return.
 *
 * The platform publishes through an rxjs subject and GraphQL consumes an async iterator, so the
 * bridge between the two lives here rather than in each resolver, which is what keeps a resolver a
 * transport adapter with nothing of its own in it.
 *
 * The two properties that matter are both about the subscriber being slower than the producer. Events
 * that arrive between two pulls are buffered rather than dropped, so a slow client sees a gap-free
 * stream instead of whatever happened to be next when it asked; and a subscription that is torn down
 * unsubscribes from the source, so a disconnected client stops costing the publisher anything.
 *
 * @param source The observable to adapt.
 * @returns An async iterable that yields each value the observable emits.
 */
export function toAsyncIterable<T>(source: Observable<T>): AsyncIterable<T> {
	return {
		[Symbol.asyncIterator](): AsyncIterator<T> {
			const buffered: T[] = [];
			let waiting: ((result: IteratorResult<T>) => void) | null = null;
			let finished = false;

			const settle = (): void => {
				if (waiting) {
					const resolve = waiting;
					waiting = null;
					resolve({ value: undefined as unknown as T, done: true });
				}
			};

			const subscription = source.subscribe({
				next: (value: T) => {
					if (waiting) {
						const resolve = waiting;
						waiting = null;
						resolve({ value, done: false });
						return;
					}

					buffered.push(value);
				},
				error: () => {
					finished = true;
					settle();
				},
				complete: () => {
					finished = true;
					settle();
				}
			});

			return {
				next: (): Promise<IteratorResult<T>> => {
					if (buffered.length) {
						return Promise.resolve({ value: buffered.shift() as T, done: false });
					}

					if (finished) {
						return Promise.resolve({ value: undefined as unknown as T, done: true });
					}

					return new Promise<IteratorResult<T>>((resolve) => {
						waiting = resolve;
					});
				},
				return: (): Promise<IteratorResult<T>> => {
					finished = true;
					subscription.unsubscribe();

					return Promise.resolve({ value: undefined as unknown as T, done: true });
				}
			};
		}
	};
}
