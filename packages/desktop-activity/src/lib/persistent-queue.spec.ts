/**
 * The persistent queue behind the desktop timer's asynchronous data sync. It runs against a real SQLite file
 * (better-sqlite3 loads under Node) in a temporary folder, because what matters here is what survives a close or a
 * crash: jobs left in the file must run again on the next start, in order, with their payload.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersistentQueue, PersistentQueueStore } from './persistent-queue';

const until = async (condition: () => boolean, timeoutMs = 3_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error('Timed out waiting for the condition');
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A promise the test resolves itself — used to hold a job "running" while the queue closes. */
const gate = () => {
	let open: () => void = () => undefined;
	const opened = new Promise<void>((resolve) => (open = resolve));
	return { open, opened };
};

describe('PersistentQueue', () => {
	let dir: string;
	let dbPath: string;
	const opened: PersistentQueue[] = [];

	const openQueue = (options: Partial<ConstructorParameters<typeof PersistentQueue>[0]> = {}) => {
		const queue = new PersistentQueue({ dbPath, maxRetries: 0, retryDelayMs: 10, ...options });
		opened.push(queue);
		return queue;
	};

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistent-queue-'));
		dbPath = path.join(dir, 'queue.sqlite3');
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		await Promise.all(opened.splice(0).map((queue) => queue.close(50)));
		jest.restoreAllMocks();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('runs every job of a queue with that queue’s processor, one at a time, in the order they were queued', async () => {
		const timer: number[] = [];
		const slot: number[] = [];
		let running = 0;
		let maxRunning = 0;
		const queue = openQueue();
		queue.register<number>('timer', async (n) => {
			running++;
			maxRunning = Math.max(maxRunning, running);
			await sleep(1);
			timer.push(n);
			running--;
		});
		queue.register<number>('slot', async (n) => {
			slot.push(n);
		});

		// Queued within the same millisecond on purpose: the order must not depend on the timestamp alone.
		await Promise.all(Array.from({ length: 30 }, (_, n) => queue.enqueue('timer', n)));
		await queue.enqueue('slot', 100);

		expect(await queue.drain()).toBe(true);
		expect(timer).toEqual(Array.from({ length: 30 }, (_, n) => n));
		expect(slot).toEqual([100]);
		expect(maxRunning).toBe(1);
		expect(queue.pending()).toBe(0);
	});

	it('gives each queue name exactly one processor and its own table', () => {
		const queue = openQueue();
		queue.register('gauzy-queue', async () => undefined);

		expect(queue.has('gauzy-queue')).toBe(true);
		expect(() => queue.register('gauzy-queue', async () => undefined)).toThrow('already has a processor');
		// Both names reduce to the same table name: refused rather than silently mixing two queues.
		expect(() => queue.register('gauzy_queue', async () => undefined)).toThrow('would share the table');
		expect(() => queue.register('--', async () => undefined)).toThrow('Invalid queue name');
	});

	it('rejects a job it cannot store, and stores nothing for it', async () => {
		const queue = openQueue();
		queue.register('timer', async () => undefined);
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		await expect(queue.enqueue('unknown', 1)).rejects.toThrow('No processor registered for queue "unknown"');
		await expect(queue.enqueue('timer', circular)).rejects.toThrow('Could not queue the job on "timer"');
		expect(queue.pending()).toBe(0);
	});

	it('resolves enqueue once the job is stored, without waiting for it to run', async () => {
		const running = gate();
		const queue = openQueue();
		queue.register('timer', () => running.opened);

		await queue.enqueue('timer', { id: 1 });

		expect(queue.pending('timer')).toBe(1);
		running.open();
		expect(await queue.drain()).toBe(true);
	});

	describe('retries and failures', () => {
		it('retries a failing job and succeeds without reporting it', async () => {
			const onJobFailed = jest.fn();
			const queue = openQueue({ maxRetries: 3, onJobFailed });
			const attempts: number[] = [];
			queue.register('timer', async (_payload, { attempt }) => {
				attempts.push(attempt);
				if (attempt < 2) throw new Error('SQLITE_BUSY');
			});

			await queue.enqueue('timer', { id: 1 });

			expect(await queue.drain()).toBe(true);
			expect(attempts).toEqual([0, 1, 2]);
			expect(onJobFailed).not.toHaveBeenCalled();
		});

		it('reports a job that fails every attempt once, drops it, and goes on with the next one', async () => {
			const onJobFailed = jest.fn();
			const queue = openQueue({ maxRetries: 2, onJobFailed });
			const seen: string[] = [];
			const failure = new Error('constraint failed');
			queue.register<{ name: string }>('timer', async ({ name }) => {
				seen.push(name);
				if (name === 'poison') throw failure;
			});

			await queue.enqueue('timer', { name: 'poison' });
			await queue.enqueue('timer', { name: 'next' });

			expect(await queue.drain()).toBe(true);
			expect(seen).toEqual(['poison', 'poison', 'poison', 'next']);
			expect(onJobFailed).toHaveBeenCalledTimes(1);
			expect(onJobFailed).toHaveBeenCalledWith('timer', { name: 'poison' }, failure);
			expect(queue.pending()).toBe(0);
		});

		it('survives an onJobFailed callback that rejects', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
			const queue = openQueue({ onJobFailed: () => Promise.reject(new Error('audit down')) });
			const seen: number[] = [];
			queue.register<number>('timer', async (n) => {
				seen.push(n);
				if (n === 1) throw new Error('boom');
			});

			await queue.enqueue('timer', 1);
			await queue.enqueue('timer', 2);

			expect(await queue.drain()).toBe(true);
			expect(seen).toEqual([1, 2]);
		});
	});

	describe('persistence', () => {
		it('runs the jobs left in the file by a previous process, in order', async () => {
			const first = openQueue();
			const blocked = gate();
			let started = false;
			first.register('timer', () => {
				started = true;
				return blocked.opened;
			});
			await first.enqueue('timer', 'a');
			await first.enqueue('timer', 'b');
			await first.enqueue('timer', 'c');
			await until(() => started);
			// "a" is running and does not finish in time: the process goes away under it.
			await first.close(20);
			blocked.open();

			const seen: string[] = [];
			const second = openQueue();
			second.register<string>('timer', async (job) => {
				seen.push(job);
			});

			await until(() => seen.length === 3);
			expect(seen).toEqual(['a', 'b', 'c']);

			// The resumed job is accounted for: the queue is not left one job behind.
			await second.enqueue('timer', 'd');
			await until(() => seen.length === 4);
			expect(seen).toEqual(['a', 'b', 'c', 'd']);
			expect(await second.drain()).toBe(true);
		});

		it('keeps a job that is waiting for a retry when the queue closes, and runs it on the next start', async () => {
			const first = openQueue({ maxRetries: 5, retryDelayMs: 60_000 });
			let firstAttempts = 0;
			first.register('timer', async () => {
				firstAttempts++;
				throw new Error('offline');
			});
			await first.enqueue('timer', { id: 7 });
			await until(() => firstAttempts === 1);

			// Must not wait for the one-minute retry delay.
			const startedClosing = Date.now();
			await first.close();
			expect(Date.now() - startedClosing).toBeLessThan(1_000);
			expect(firstAttempts).toBe(1);

			const seen: unknown[] = [];
			const second = openQueue();
			second.register('timer', async (job) => {
				seen.push(job);
			});
			await until(() => seen.length === 1);
			expect(seen).toEqual([{ id: 7 }]);
		});

		it('lets the running job finish before closing, so it is not run twice', async () => {
			const first = openQueue();
			const running = gate();
			let started = false;
			let finished = 0;
			first.register('timer', async () => {
				started = true;
				await running.opened;
				finished++;
			});
			await first.enqueue('timer', 1);
			await until(() => started);

			const closing = first.close(2_000);
			running.open();
			await closing;
			expect(finished).toBe(1);

			const second = openQueue();
			const rerun = jest.fn(async () => undefined);
			second.register('timer', rerun);
			expect(second.pending()).toBe(0);
			await sleep(30);
			expect(rerun).not.toHaveBeenCalled();
		});
	});

	describe('settle', () => {
		it('waits for the jobs stored before the call, not for the ones queued after it', async () => {
			const queue = openQueue();
			const first = gate();
			const later = gate();
			const seen: string[] = [];
			queue.register<string>('timer', async (job) => {
				if (job === 'before') await first.opened;
				if (job === 'after') await later.opened;
				seen.push(job);
			});
			await queue.enqueue('timer', 'before');

			let settled: boolean | undefined;
			const settling = queue.settle(2_000).then((result) => (settled = result));
			await queue.enqueue('timer', 'after');
			await sleep(30);
			expect(settled).toBeUndefined();

			first.open();
			await settling;
			// "after" is still held: settle did not wait for it.
			expect(settled).toBe(true);
			expect(seen).toEqual(['before']);
			later.open();
			expect(await queue.drain()).toBe(true);
		});

		it('gives up after the timeout while an earlier job is still running', async () => {
			const queue = openQueue();
			const held = gate();
			queue.register('timer', () => held.opened);
			await queue.enqueue('timer', 1);

			expect(await queue.settle(50)).toBe(false);
			expect(queue.isIdle()).toBe(false);
			held.open();
			expect(await queue.drain()).toBe(true);
			expect(queue.isIdle()).toBe(true);
		});
	});

	describe('canRun', () => {
		it('keeps jobs stored while a queue may not run, and runs them in order once it may', async () => {
			const queue = openQueue();
			let online = false;
			const seen: number[] = [];
			queue.register<number>(
				'upload',
				async (n) => {
					seen.push(n);
				},
				{ canRun: () => online, recheckMs: 10 }
			);
			await queue.enqueue('upload', 1);
			await queue.enqueue('upload', 2);
			await sleep(50);
			expect(seen).toEqual([]);
			expect(queue.pending('upload')).toBe(2);

			online = true;
			await until(() => seen.length === 2);
			expect(seen).toEqual([1, 2]);
		});
	});

	describe('close', () => {
		it('stores or rejects a job queued while it closes, never leaves it pending', async () => {
			const queue = openQueue();
			const seen: number[] = [];
			queue.register<number>('timer', async (n) => {
				seen.push(n);
			});

			const outcome = queue.enqueue('timer', 1).then(
				() => 'stored',
				(error: Error) => error.message
			);
			await queue.close();

			const settled = await Promise.race([outcome, sleep(1_000).then(() => 'still pending')]);
			expect(settled).not.toBe('still pending');
		});

		it('does not leave a rejection unhandled when completing a job throws', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
			const unhandled = jest.fn();
			process.on('unhandledRejection', unhandled);
			try {
				const queue = openQueue();
				queue.register('timer', async () => undefined);
				// A throwing 'task_finish' listener makes better-queue's completion callback throw.
				(queue as any).queues.get('timer').queue.on('task_finish', () => {
					throw new Error('listener failed');
				});

				await queue.enqueue('timer', 1);
				await sleep(50);

				expect(unhandled).not.toHaveBeenCalled();
			} finally {
				process.off('unhandledRejection', unhandled);
			}
		});

		it('refuses new work once closed', async () => {
			const queue = openQueue();
			queue.register('timer', async () => undefined);
			await queue.close();

			expect(queue.isClosed).toBe(true);
			await expect(queue.enqueue('timer', 1)).rejects.toThrow('PersistentQueue is closed');
			expect(() => queue.register('other', async () => undefined)).toThrow('PersistentQueue is closed');
			expect(await queue.drain(10)).toBe(false);
		});

		it('is idempotent and releases the database file', async () => {
			const queue = openQueue();
			queue.register('timer', async () => undefined);
			await queue.enqueue('timer', 1);
			await queue.drain();

			await Promise.all([queue.close(), queue.close()]);

			// On Windows an open SQLite handle would keep these files locked.
			expect(() => fs.rmSync(dir, { recursive: true, force: true })).not.toThrow();
		});
	});
});

describe('PersistentQueueStore', () => {
	let dir: string;
	let store: PersistentQueueStore;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistent-queue-store-'));
		store = new PersistentQueueStore({ path: path.join(dir, 'store.sqlite3'), tableName: 'jobs' });
	});

	afterEach(() => {
		store.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('hands back running jobs with their payload, grouped by lock, and counts them', () => {
		const noop = () => undefined;
		store.putTask('one', { payload: 1 }, undefined, noop);
		store.putTask('two', { payload: 2 }, undefined, noop);

		let lockId = '';
		store.takeFirstN(1, (_err, id) => (lockId = id));

		let running: Record<string, unknown> = {};
		store.getRunningTasks((_err, map) => (running = map));
		let length = -1;
		store.connect((_err, count) => (length = count));

		expect(running).toEqual({ [lockId]: { one: { payload: 1 } } });
		expect(length).toBe(2);
	});
});
