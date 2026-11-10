import { Logger } from '@nestjs/common';
import { SchedulerQueueService } from '@gauzy/scheduler';
import {
	EVENT_OUTBOX_APPEND_DEBOUNCE_MS,
	EVENT_OUTBOX_APPEND_FOLLOW_UP_MS,
	EVENT_OUTBOX_DISPATCH_JOB,
	EVENT_OUTBOX_INLINE_SWEEP_MS,
	EVENT_OUTBOX_QUEUE_NAME
} from './event-outbox-constant';
import { EventOutboxAppendSignal } from './event-outbox-append.signal';
import {
	EventOutboxInlineDispatch,
	EventOutboxQueueDispatchTrigger,
	isEventOutboxInlineDispatchEnabled
} from './event-outbox-dispatch.trigger';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';

/**
 * Before these, an appended event waited for the per-minute tick when the platform had a queue, and was never
 * delivered at all when it had none: a chat message reached the other person a minute later, or only when their
 * page polled. An append now asks for a pass within moments, in both shapes of deployment.
 */

beforeEach(() => {
	jest.useFakeTimers();
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

/** Lets the promise chains a timer started run to the end. */
async function settle(): Promise<void> {
	for (let i = 0; i < 10; i += 1) {
		await Promise.resolve();
	}
}

describe('EventOutboxAppendSignal', () => {
	it('reports how this process delivers, and nothing once its listener is gone', () => {
		const signal = new EventOutboxAppendSignal();
		expect(signal.deliveryMode()).toBe('none');

		const stop = signal.listen(() => undefined, 'queue');
		expect(signal.deliveryMode()).toBe('queue');

		stop();
		expect(signal.deliveryMode()).toBe('none');
	});

	it('never lets a listener fail the append that announced itself', () => {
		const signal = new EventOutboxAppendSignal();
		const after = jest.fn();
		signal.listen(() => {
			throw new Error('gone');
		}, 'inline');
		signal.listen(after, 'inline');

		expect(() => signal.notify()).not.toThrow();
		expect(after).toHaveBeenCalledTimes(1);
	});
});

describe('EventOutboxInlineDispatch — no queue: the API drains the outbox itself', () => {
	function inline(drain: jest.Mock = jest.fn(async () => ({ passes: 1, claimed: 0 }))) {
		const signal = new EventOutboxAppendSignal();
		const dispatch = new EventOutboxInlineDispatch(signal, { drain } as unknown as EventOutboxDispatcher);
		dispatch.onModuleInit();
		return { signal, dispatch, drain };
	}

	it('drains once a moment after a burst of appends, and once more a second later in case a commit came late', async () => {
		const { signal, drain, dispatch } = inline();

		signal.notify();
		signal.notify();
		signal.notify();
		expect(drain).not.toHaveBeenCalled();

		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(1);
		expect(drain).toHaveBeenCalledWith(expect.objectContaining({ quiet: true }));

		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_FOLLOW_UP_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(2);

		// Control: with no new append, nothing else runs until the sweep.
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_FOLLOW_UP_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(2);
		expect(signal.deliveryMode()).toBe('inline');

		dispatch.onModuleDestroy();
	});

	it('runs one drain at a time, and one more right after when asked during it', async () => {
		let finish!: () => void;
		const drain = jest.fn(
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ passes: 1, claimed: 1 });
				})
		);
		const { signal, dispatch } = inline(drain);

		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(1);

		// Two more appends while the drain runs: their rows may have been written after its claim.
		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(1);

		finish();
		await settle();
		expect(drain).toHaveBeenCalledTimes(2);

		finish();
		await settle();
		dispatch.onModuleDestroy();
	});

	it('sweeps on its own, for retries that came due and rows another process appended', async () => {
		const { dispatch, drain } = inline();
		dispatch.onApplicationBootstrap();

		jest.advanceTimersByTime(EVENT_OUTBOX_INLINE_SWEEP_MS);
		await settle();
		expect(drain).toHaveBeenCalledTimes(1);

		dispatch.onModuleDestroy();
		jest.advanceTimersByTime(EVENT_OUTBOX_INLINE_SWEEP_MS * 3);
		await settle();
		expect(drain).toHaveBeenCalledTimes(1);
	});

	it('keeps going after a drain fails: the next append or sweep tries again', async () => {
		const drain = jest.fn().mockRejectedValueOnce(new Error('database is locked')).mockResolvedValue({ passes: 1 });
		const { signal, dispatch } = inline(drain);

		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_FOLLOW_UP_MS);
		await settle();

		expect(drain).toHaveBeenCalledTimes(2);
		dispatch.onModuleDestroy();
	});

	it('is on unless switched off explicitly', () => {
		const previous = process.env['EVENT_OUTBOX_INLINE_DISPATCH'];
		try {
			delete process.env['EVENT_OUTBOX_INLINE_DISPATCH'];
			expect(isEventOutboxInlineDispatchEnabled()).toBe(true);
			process.env['EVENT_OUTBOX_INLINE_DISPATCH'] = 'false';
			expect(isEventOutboxInlineDispatchEnabled()).toBe(false);
		} finally {
			if (previous === undefined) delete process.env['EVENT_OUTBOX_INLINE_DISPATCH'];
			else process.env['EVENT_OUTBOX_INLINE_DISPATCH'] = previous;
		}
	});
});

describe('EventOutboxQueueDispatchTrigger — with a queue: an append asks for a pass at once', () => {
	function queued(enqueue: jest.Mock = jest.fn(async () => undefined)) {
		const signal = new EventOutboxAppendSignal();
		const trigger = new EventOutboxQueueDispatchTrigger(signal, { enqueue } as unknown as SchedulerQueueService);
		trigger.onModuleInit();
		return { signal, trigger, enqueue };
	}

	it('enqueues one draining job for a burst, on the queue and under the job name the worker answers', async () => {
		jest.setSystemTime(new Date('2026-11-10T20:00:00.000Z'));
		const { signal, enqueue, trigger } = queued();

		signal.notify();
		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();

		expect(enqueue).toHaveBeenCalledTimes(1);
		const [request] = enqueue.mock.calls[0];
		expect(request).toMatchObject({
			queueName: EVENT_OUTBOX_QUEUE_NAME,
			jobName: EVENT_OUTBOX_DISPATCH_JOB,
			data: { drain: true },
			options: { removeOnComplete: true }
		});
		// A job id per quarter second: appends from several requests at once share one job.
		expect(request.options.jobId).toMatch(/^append-\d+$/);
		expect(request.options.jobId).not.toContain(':');
		expect(signal.deliveryMode()).toBe('queue');

		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_FOLLOW_UP_MS);
		await settle();
		expect(enqueue).toHaveBeenCalledTimes(2);
		expect(enqueue.mock.calls[1][0].options.jobId).toMatch(/^append-late-\d+$/);

		trigger.onModuleDestroy();
	});

	it('logs a queue that refuses the job instead of failing anything', async () => {
		const { signal, trigger } = queued(jest.fn().mockRejectedValue(new Error('Connection is closed.')));

		signal.notify();
		jest.advanceTimersByTime(EVENT_OUTBOX_APPEND_DEBOUNCE_MS);
		await settle();

		expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Connection is closed.'));
		trigger.onModuleDestroy();
	});

	it('claims no prompt delivery where there is no queue service to ask', () => {
		const signal = new EventOutboxAppendSignal();
		const trigger = new EventOutboxQueueDispatchTrigger(signal, undefined);
		trigger.onModuleInit();

		expect(signal.deliveryMode()).toBe('none');
	});
});
