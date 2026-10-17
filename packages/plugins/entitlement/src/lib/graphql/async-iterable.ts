import { Observable } from 'rxjs';
import { observableToAsyncIterable } from '@gauzy/core';

/**
 * Adapts a platform event stream to the async iterable a GraphQL subscription has to return.
 *
 * @deprecated This package carried its own copy, and the stream built on it re-read events as the
 * publisher. The adapter is the kernel's now: a subscription field returns `tenantScopedEventStream` from
 * `@gauzy/core`, which holds every event to the subscriber's tenant, and `observableToAsyncIterable` is
 * the unscoped adapter it is built on. This name is kept, and delegates, so nothing that imports it
 * breaks; nothing in this package does any more.
 *
 * @param source The observable to adapt.
 * @returns An async iterable that yields each value the observable emits.
 */
export function toAsyncIterable<T>(source: Observable<T>): AsyncIterable<T> {
	return observableToAsyncIterable(source);
}
