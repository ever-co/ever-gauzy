import { BoundedEventQueue, readCountEnv } from './jitsu-event-queue';

/** Lets every queued `setImmediate` and promise callback run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A sender whose calls stay open until released, so the test can count what is in flight. */
function heldSender() {
	const calls: Array<{ event: number; release: () => void; fail: (error: Error) => void }> = [];
	const send = jest.fn(
		(event: number) =>
			new Promise<void>((resolve, reject) => {
				calls.push({ event, release: resolve, fail: reject });
			})
	);
	return { calls, send };
}

describe('BoundedEventQueue', () => {
	it('sends nothing on the caller stack, so an ORM hook that offers an event returns at once', () => {
		const { send } = heldSender();
		const queue = new BoundedEventQueue(send, { concurrency: 4, maxQueued: 10 });

		queue.offer(() => 1);

		expect(send).not.toHaveBeenCalled();
	});

	it('never has more than `concurrency` events in flight during a burst (the onboarding case)', async () => {
		const { calls, send } = heldSender();
		const queue = new BoundedEventQueue(send, { concurrency: 4, maxQueued: 5000 });

		// 3,136 role permissions written in one save: every row offers an event.
		for (let i = 0; i < 3136; i++) queue.offer(() => i);
		await settle();

		expect(send).toHaveBeenCalledTimes(4);
		expect(queue.pending).toBe(3136);

		// Freeing slots lets the backlog through, still four at a time, in order.
		calls.splice(0, 2).forEach((call) => call.release());
		await settle();
		expect(send).toHaveBeenCalledTimes(6);
		expect(calls.map((call) => call.event)).toEqual([2, 3, 4, 5]);
	});

	it('sends every queued event eventually', async () => {
		const sent: number[] = [];
		const queue = new BoundedEventQueue(async (event: number) => void sent.push(event), {
			concurrency: 2,
			maxQueued: 100
		});

		for (let i = 0; i < 50; i++) queue.offer(() => i);
		while (queue.pending > 0) await settle();

		expect(sent).toEqual(Array.from({ length: 50 }, (_, i) => i));
	});

	it('drops what does not fit, without building it, and reports the count at most once per interval', async () => {
		const { send } = heldSender();
		const onDropped = jest.fn();
		const queue = new BoundedEventQueue(send, { concurrency: 2, maxQueued: 3, onDropped, reportIntervalMs: 60_000 });
		const build = jest.fn((i: number) => i);

		const kept = Array.from({ length: 10 }, (_, i) => queue.offer(() => build(i)));

		expect(kept).toEqual([true, true, true, false, false, false, false, false, false, false]);
		expect(build).toHaveBeenCalledTimes(3);
		expect(onDropped).toHaveBeenCalledTimes(1);
		expect(onDropped).toHaveBeenCalledWith(1);

		// Within the interval, further drops are counted, not reported.
		queue.offer(() => build(99));
		expect(onDropped).toHaveBeenCalledTimes(1);
	});

	it('takes as many events as there are free slots even with no backlog allowed', () => {
		const { send } = heldSender();
		const queue = new BoundedEventQueue(send, { concurrency: 4, maxQueued: 0 });

		const kept = Array.from({ length: 6 }, (_, i) => queue.offer(() => i));

		expect(kept).toEqual([true, true, true, true, false, false]);
	});

	it('keeps sending after a failed send', async () => {
		const { calls, send } = heldSender();
		const queue = new BoundedEventQueue(send, { concurrency: 1, maxQueued: 10 });

		queue.offer(() => 1);
		queue.offer(() => 2);
		await settle();
		calls[0].fail(new Error('socket hang up'));
		await settle();

		expect(send).toHaveBeenCalledTimes(2);
		expect(send).toHaveBeenLastCalledWith(2);
	});
});

describe('readCountEnv', () => {
	it.each([
		[undefined, 4],
		['', 4],
		['8', 8],
		[' 12 ', 12],
		['0', 0],
		['-1', 4],
		['10abc', 4],
		['1e3', 4],
		['2.5', 4]
	])('reads %p as %p', (value, expected) => {
		const env = value === undefined ? {} : { JITSU_MAX_CONCURRENT_EVENTS: value };
		expect(readCountEnv('JITSU_MAX_CONCURRENT_EVENTS', 4, env)).toBe(expected);
	});
});
