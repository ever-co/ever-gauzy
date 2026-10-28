import { BoundedEventQueue, readCountEnv } from './jitsu-event-queue';

/**
 * Lets the queue's `setImmediate` drains and the promise callbacks they start run. A zero-delay timer is not
 * enough: the timers phase can come before the check phase, so it may resolve before the drain has run.
 */
const settle = async () => {
	for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setImmediate(resolve));
};

/**
 * A clock the test moves by hand, for the queue's interval arithmetic, while Jest's fake timers run its report
 * timer. The drains still use the real `setImmediate`.
 */
function manualClock(start = 1_000) {
	let time = start;
	jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
	return {
		now: () => time,
		/** Moves the queue's clock and Jest's timers together. */
		advance(ms: number) {
			time += ms;
			jest.advanceTimersByTime(ms);
		},
		/** Moves only the queue's clock: a timer that is due has not run yet, as when the event loop is busy. */
		skip(ms: number) {
			time += ms;
		}
	};
}

afterEach(() => jest.useRealTimers());

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
		const clock = manualClock();
		const queue = new BoundedEventQueue(send, {
			concurrency: 2,
			maxQueued: 3,
			onDropped,
			reportIntervalMs: 60_000,
			now: clock.now
		});
		const build = jest.fn((i: number) => i);

		const kept = Array.from({ length: 10 }, (_, i) => queue.offer(() => build(i)));

		expect(kept).toEqual([true, true, true, false, false, false, false, false, false, false]);
		expect(build).toHaveBeenCalledTimes(3);
		expect(onDropped).toHaveBeenCalledTimes(1);
		expect(onDropped).toHaveBeenCalledWith(1);

		// Within the interval, further drops are counted, not reported.
		clock.advance(59_999);
		queue.offer(() => build(99));
		expect(onDropped).toHaveBeenCalledTimes(1);
	});

	it('reports the rest of a burst when the interval ends, without waiting for another drop', async () => {
		const { send } = heldSender();
		const onDropped = jest.fn();
		const clock = manualClock();
		const queue = new BoundedEventQueue(send, {
			concurrency: 2,
			maxQueued: 3,
			onDropped,
			reportIntervalMs: 30,
			now: clock.now
		});

		for (let i = 0; i < 10; i++) queue.offer(() => i);
		expect(onDropped.mock.calls).toEqual([[1]]);

		clock.advance(29);
		expect(onDropped.mock.calls).toEqual([[1]]);
		clock.advance(1);

		// 7 dropped in all: the first one at once, the other 6 when the interval ended.
		expect(onDropped.mock.calls).toEqual([[1], [6]]);
	});

	it('cancels a due report timer that has not run when a drop reports first, so no interval reports twice', () => {
		const { send } = heldSender();
		const onDropped = jest.fn();
		const clock = manualClock();
		const queue = new BoundedEventQueue(send, {
			concurrency: 2,
			maxQueued: 3,
			onDropped,
			reportIntervalMs: 30,
			now: clock.now
		});

		// A burst: the first drop is reported, the other 6 wait for the timer (due 30 ms later).
		for (let i = 0; i < 10; i++) queue.offer(() => i);
		clock.advance(20);

		// The interval is over, but the busy event loop has not run the timer yet: this drop reports all 7.
		clock.skip(20);
		queue.offer(() => 99);
		expect(onDropped.mock.calls).toEqual([[1], [7]]);

		// A drop in the new interval waits for ITS end; the stale timer must not report it 10 ms later.
		queue.offer(() => 100);
		clock.advance(10);
		expect(onDropped.mock.calls).toEqual([[1], [7]]);

		clock.advance(20);
		expect(onDropped.mock.calls).toEqual([[1], [7], [1]]);
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
