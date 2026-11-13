import { StreamableFile } from '@nestjs/common';
import { isAsyncIterable } from 'graphql/jsutils/isAsyncIterable';
import { lastValueFrom, of } from 'rxjs';
import { isPassedThrough, TransformInterceptor } from './transform.interceptor';

/** What a handler answered, after the application's serialization interceptor. */
function answered<T>(value: T): Promise<unknown> {
	return lastValueFrom(
		new TransformInterceptor().intercept({ getHandler: () => () => undefined } as never, { handle: () => of(value) })
	);
}

/** The event stream of a subscription field, as the subscription helpers build it. */
function eventStream<T>(values: T[]): AsyncIterableIterator<T> {
	const queue = [...values];
	const stream: AsyncIterableIterator<T> = {
		next: async () => (queue.length ? { value: queue.shift() as T, done: false } : { value: undefined, done: true }),
		return: async () => ({ value: undefined, done: true }),
		throw: async (error?: unknown) => {
			throw error;
		},
		[Symbol.asyncIterator]() {
			return stream;
		}
	};
	return stream;
}

/**
 * The serialization interceptor is registered for the whole application, so the event stream a GraphQL subscription
 * field returns passes through it too. Copying the stream itself turns it into a plain object graphql-js refuses
 * ("Subscription field must return Async Iterable"), which closes every subscriber's socket with 4500 right after
 * the connection is acknowledged.
 */
describe('TransformInterceptor', () => {
	it('hands the event stream of a subscription field over as it is', async () => {
		const stream = eventStream([{ eventName: 'chat_message.created' }]);

		const result = await answered(stream);

		expect(result).toBe(stream);
		expect(isAsyncIterable(result)).toBe(true);
		await expect((result as AsyncIterableIterator<unknown>).next()).resolves.toEqual({
			value: { eventName: 'chat_message.created' },
			done: false
		});
	});

	it('hands an async generator over as it is', async () => {
		async function* events() {
			yield { eventName: 'task.updated' };
		}
		const stream = events();

		await expect(answered(stream)).resolves.toBe(stream);
	});

	it('still serialises a response body, and still removes what a response never carries', async () => {
		const body = { id: 'user-1', email: 'ada@example.com', hash: 'secret', refreshToken: 'secret' };

		await expect(answered(body)).resolves.toEqual({ id: 'user-1', email: 'ada@example.com' });
	});

	it('still serialises a list', async () => {
		await expect(answered([{ id: 'a' }, { id: 'b' }])).resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
	});

	it('still passes bytes and primitives through', async () => {
		const bytes = Buffer.from('abc');
		const file = new StreamableFile(bytes);

		await expect(answered(bytes)).resolves.toBe(bytes);
		await expect(answered(file)).resolves.toBe(file);
		await expect(answered('text')).resolves.toBe('text');
		await expect(answered(null)).resolves.toBeNull();
	});
});

describe('isPassedThrough', () => {
	it('answers true for an event stream and false for the records a route answers', () => {
		expect(isPassedThrough(eventStream([]))).toBe(true);
		expect(isPassedThrough({ items: [], total: 0 })).toBe(false);
		expect(isPassedThrough([])).toBe(false);
		expect(isPassedThrough(new Map())).toBe(false);
	});
});
