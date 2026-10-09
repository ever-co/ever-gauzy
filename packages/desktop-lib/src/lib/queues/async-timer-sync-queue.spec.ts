/**
 * The asynchronous timer data sync: the job processor shared by both queues, and the persistent queue that runs it.
 *
 * The persistent queue runs against a real SQLite file in a temporary folder. The local database is replaced by fakes
 * (the timer service and the ActivityWatch services), because what is checked here is which writes a job makes —
 * above all the offline flags, since a session marked unsynced by mistake is pushed a second time by offline sync.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let userData = '';
jest.mock('electron', () => ({ app: { getPath: () => userData } }), { virtual: true });

const eventSaves: Array<{ table: string; events: unknown }> = [];
const windowClears = jest.fn(async () => undefined);
jest.mock('../integrations', () => {
	const tables = {
		AFK: 'afk_events',
		WINDOW: 'window_events',
		CHROME: 'chrome_events',
		FIREFOX: 'firefox_events',
		EDGE: 'edge_events'
	};
	const service = (table: string) =>
		class {
			save = async (events: unknown) => {
				eventSaves.push({ table, events });
			};
			clear = windowClears;
		};
	return {
		ActivityWatchEventTableList: tables,
		ActivityWatchWindowService: service(tables.WINDOW),
		ActivityWatchAfkService: service(tables.AFK),
		ActivityWatchChromeService: service(tables.CHROME),
		ActivityWatchFirefoxService: service(tables.FIREFOX),
		ActivityWatchEdgeService: service(tables.EDGE)
	};
});

const removeActivity = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../desktop-wakatime', () => ({ metaData: { removeActivity: (...args: unknown[]) => removeActivity(...args) } }));

jest.mock('../offline', () => ({ Timer: jest.requireActual('../offline/models/timer.model').Timer }));

import { AsyncTimerSyncQueue, ASYNC_TIMER_SYNC_QUEUE_FILE, isAsyncTimerDataSyncEnabled } from './async-timer-sync-queue';
import { ITimerQueueJob, TimerQueueProcessor } from './timer-queue-processor';

type TimerWrite = Record<string, unknown>;

/** Records what each job writes to the `timers` table; `hold()` keeps the duration writes waiting. */
const fakeTimerService = () => {
	const writes: TimerWrite[] = [];
	let held: Promise<void> | null = null;
	let release: () => void = () => undefined;
	const service = {
		writes,
		failures: 0,
		update: jest.fn(async (timer: { toObject(): TimerWrite; id?: number }) => {
			if (held && timer.toObject().duration !== undefined) await held;
			if (service.failures > 0) {
				service.failures--;
				throw new Error('SQLITE_BUSY: database is locked');
			}
			writes.push({ id: timer.id, ...timer.toObject() });
		}),
		hold() {
			held = new Promise<void>((resolve) => (release = resolve));
		},
		release() {
			held = null;
			release();
		}
	};
	return service;
};

const fakeOfflineMode = (enabled = false) => ({ enabled }) as any;
const knex = { name: 'knex' } as any;

const until = async (condition: () => boolean, timeoutMs = 3_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error('Timed out waiting for the condition');
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

const duration = (id: number, ms: number): ITimerQueueJob => ({ type: 'update-duration-timer', data: { id, duration: ms } });

beforeEach(() => {
	eventSaves.length = 0;
	windowClears.mockClear();
	removeActivity.mockClear();
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
	jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('TimerQueueProcessor', () => {
	it('records a duration without touching the sync flags while online', async () => {
		const timers = fakeTimerService();
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode(false));

		await processor.process(duration(4, 1500), knex);

		expect(timers.writes).toHaveLength(1);
		expect(timers.writes[0]).toMatchObject({ id: 4, duration: 1500 });
		expect(timers.writes[0].synced).toBeUndefined();
		expect(timers.writes[0].isStartedOffline).toBeUndefined();
	});

	it('marks the timer unsynced, and only that, when the duration is recorded offline', async () => {
		const timers = fakeTimerService();
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode(true));

		await processor.process(duration(4, 1500), knex);

		expect(timers.writes[0]).toMatchObject({ id: 4, duration: 1500, synced: false });
		expect(timers.writes[0].isStartedOffline).toBeUndefined();
	});

	it('leaves the sync flags alone when a job says so, even offline', async () => {
		const timers = fakeTimerService();
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode(true));

		await processor.process({ type: 'update-duration-timer', data: { id: 1, duration: 10, markUnsynced: false } }, knex);

		expect(timers.writes[0]).toMatchObject({ id: 1, duration: 10 });
		expect(timers.writes[0].synced).toBeUndefined();
	});

	it('marks a timer unsynced on its own', async () => {
		const timers = fakeTimerService();
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode());

		await processor.markTimerUnsynced(3);

		expect(timers.writes).toEqual([expect.objectContaining({ id: 3, synced: false, duration: undefined })]);
	});

	it('links the timer to its time slot and timesheet', async () => {
		const timers = fakeTimerService();
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode());

		await processor.process(
			{ type: 'update-timer-time-slot', data: { id: 9, timeSlotId: 'slot-1', timeSheetId: 'sheet-1', timeLogId: 'log-1' } },
			knex
		);

		expect(timers.writes[0]).toMatchObject({ id: 9, timeslotId: 'slot-1', timesheetId: 'sheet-1' });
		expect(timers.writes[0].synced).toBeUndefined();
	});

	it('saves ActivityWatch events in their own table, and clears window and WakaTime data', async () => {
		const processor = new TimerQueueProcessor(fakeTimerService() as any, fakeOfflineMode());
		const events = [{ eventId: 1 }];

		for (const table of ['window_events', 'afk_events', 'chrome_events', 'firefox_events', 'edge_events']) {
			await processor.process({ type: table, data: events }, knex);
		}
		await processor.process({ type: 'remove-window-events' }, knex);
		await processor.process({ type: 'remove-wakatime-events', data: [3, 4] }, knex);
		await processor.process({ type: 'something-else' }, knex);

		expect(eventSaves.map(({ table }) => table)).toEqual([
			'window_events',
			'afk_events',
			'chrome_events',
			'firefox_events',
			'edge_events'
		]);
		expect(eventSaves.every(({ events: saved }) => saved === events)).toBe(true);
		expect(windowClears).toHaveBeenCalledTimes(1);
		expect(removeActivity).toHaveBeenCalledWith(knex, { idsWakatime: [3, 4] });
	});

	it('lets a failure reach the caller', async () => {
		const timers = fakeTimerService();
		timers.failures = 1;
		const processor = new TimerQueueProcessor(timers as any, fakeOfflineMode());

		await expect(processor.process(duration(1, 1), knex)).rejects.toThrow('SQLITE_BUSY');
	});
});

describe('isAsyncTimerDataSyncEnabled', () => {
	it('is on only when the setting is exactly true', () => {
		expect(isAsyncTimerDataSyncEnabled(undefined)).toBe(false);
		expect(isAsyncTimerDataSyncEnabled(null)).toBe(false);
		expect(isAsyncTimerDataSyncEnabled({})).toBe(false);
		expect(isAsyncTimerDataSyncEnabled({ asyncTimerDataSync: 'true' })).toBe(false);
		expect(isAsyncTimerDataSyncEnabled({ asyncTimerDataSync: false })).toBe(false);
		expect(isAsyncTimerDataSyncEnabled({ asyncTimerDataSync: true })).toBe(true);
	});
});

describe('AsyncTimerSyncQueue', () => {
	const opened: AsyncTimerSyncQueue[] = [];

	const openQueue = (timers: ReturnType<typeof fakeTimerService>, offlineMode = fakeOfflineMode(), extra = {}) => {
		const onJobFailed = jest.fn();
		const queue = new AsyncTimerSyncQueue({
			processor: new TimerQueueProcessor(timers as any, offlineMode),
			offlineMode,
			onJobFailed,
			retryDelayMs: 5,
			...extra
		});
		opened.push(queue);
		return { queue, onJobFailed };
	};

	beforeEach(() => {
		userData = fs.mkdtempSync(path.join(os.tmpdir(), 'async-timer-sync-'));
	});

	afterEach(async () => {
		await Promise.all(opened.splice(0).map((queue) => queue.close(50)));
		fs.rmSync(userData, { recursive: true, force: true });
	});

	it('stores jobs in the user data folder and applies them in order', async () => {
		const timers = fakeTimerService();
		const { queue } = openQueue(timers);

		for (let second = 1; second <= 5; second++) {
			await queue.processWithQueue('gauzy-queue', duration(1, second * 1000), knex);
		}

		expect(await queue.drain()).toBe(true);
		expect(fs.existsSync(path.join(userData, ASYNC_TIMER_SYNC_QUEUE_FILE))).toBe(true);
		expect(timers.writes.map((write) => write.duration)).toEqual([1000, 2000, 3000, 4000, 5000]);
	});

	it('marks a timer tracked offline unsynced when the duration is queued; the stored duration never does', async () => {
		const timers = fakeTimerService();
		const offline = fakeOfflineMode(false);
		const { queue } = openQueue(timers, offline);
		timers.hold();

		await queue.processWithQueue('gauzy-queue', duration(1, 1000), knex);
		expect(timers.writes).toEqual([]);
		offline.enabled = true;
		await queue.processWithQueue('gauzy-queue', duration(1, 2000), knex);
		expect(timers.writes).toEqual([expect.objectContaining({ id: 1, synced: false, duration: undefined })]);

		// Offline sync uploads the timer before the stored durations run…
		offline.enabled = false;
		timers.writes.push({ id: 1, synced: true });
		timers.release();

		// …which then must not mark it unsynced again.
		expect(await queue.drain()).toBe(true);
		expect(timers.writes.slice(2).map(({ duration: ms, synced }) => ({ ms, synced }))).toEqual([
			{ ms: 1000, synced: undefined },
			{ ms: 2000, synced: undefined }
		]);
	});

	it('settles: waits for the jobs queued so far before what reads the database', async () => {
		const timers = fakeTimerService();
		const { queue } = openQueue(timers);
		timers.hold();
		await queue.processWithQueue('gauzy-queue', duration(1, 1000), knex);

		expect(await queue.settle(50)).toBe(false);
		expect(queue.isIdle()).toBe(false);
		timers.release();
		expect(await queue.settle(2_000)).toBe(true);
		expect(timers.writes).toHaveLength(1);
	});

	it('runs the jobs a quit or crash left behind on the next start, once each', async () => {
		const before = fakeTimerService();
		const { queue: first } = openQueue(before);
		before.hold();
		await first.processWithQueue('gauzy-queue', duration(1, 1000), knex);
		await first.processWithQueue('gauzy-queue', { type: 'window_events', data: [{ eventId: 5 }] }, knex);
		await first.processWithQueue('gauzy-queue', duration(1, 2000), knex);
		await until(() => before.update.mock.calls.length === 1);
		// The app goes away while the first job is still writing.
		await first.close(20);

		const after = fakeTimerService();
		const { queue: second } = openQueue(after);
		second.open(knex);

		expect(await second.drain()).toBe(true);
		expect(after.writes.map((write) => write.duration)).toEqual([1000, 2000]);
		expect(eventSaves).toEqual([{ table: 'window_events', events: [{ eventId: 5 }] }]);
		before.release();
	});

	it('retries a write that fails, and reports a job only once it has failed every attempt', async () => {
		const timers = fakeTimerService();
		const { queue, onJobFailed } = openQueue(timers, fakeOfflineMode(), { maxRetries: 2 });

		timers.failures = 2;
		await queue.processWithQueue('gauzy-queue', duration(1, 1000), knex);
		expect(await queue.drain()).toBe(true);
		expect(timers.writes).toHaveLength(1);
		expect(onJobFailed).not.toHaveBeenCalled();

		timers.failures = 3;
		await queue.processWithQueue('gauzy-queue', duration(1, 2000), knex);
		await queue.processWithQueue('gauzy-queue', duration(1, 3000), knex);
		expect(await queue.drain()).toBe(true);
		expect(onJobFailed).toHaveBeenCalledTimes(1);
		expect(onJobFailed.mock.calls[0][0]).toMatchObject({ type: 'update-duration-timer', data: { id: 1, duration: 2000 } });
		expect(timers.writes.map((write) => write.duration)).toEqual([1000, 3000]);
	});

	it('gives every queue name its own processor', async () => {
		const timers = fakeTimerService();
		const { queue } = openQueue(timers);

		await queue.processWithQueue('gauzy-queue', duration(1, 1000), knex);
		await queue.processWithQueue('other-queue', duration(2, 2000), knex);

		expect(await queue.drain()).toBe(true);
		expect(timers.writes.map((write) => write.id).sort()).toEqual([1, 2]);
	});

	it('rejects a job it cannot store once closed', async () => {
		const { queue } = openQueue(fakeTimerService());
		await queue.close();

		await expect(queue.processWithQueue('gauzy-queue', duration(1, 1), knex)).rejects.toThrow('closed');
	});

	describe('openLeftovers', () => {
		it('opens nothing — not even creates the file — when the setting was never on', async () => {
			const timers = fakeTimerService();
			const offlineMode = fakeOfflineMode();
			const options = { processor: new TimerQueueProcessor(timers as any, offlineMode), offlineMode, onJobFailed: jest.fn() };

			expect(AsyncTimerSyncQueue.openLeftovers(knex, options)).toBeNull();
			expect(fs.readdirSync(userData)).toEqual([]);
		});

		it('runs what an asynchronous session left behind', async () => {
			const before = fakeTimerService();
			const { queue: first } = openQueue(before);
			before.hold();
			await first.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			await first.processWithQueue('gauzy-queue', duration(1, 2000), knex);
			await first.close(20);

			const after = fakeTimerService();
			const offlineMode = fakeOfflineMode();
			const options = { processor: new TimerQueueProcessor(after as any, offlineMode), offlineMode, onJobFailed: jest.fn() };

			const leftovers = AsyncTimerSyncQueue.openLeftovers(knex, options);
			opened.push(leftovers);
			expect(await leftovers.drain()).toBe(true);
			expect(after.writes.map((write) => write.duration)).toEqual([1000, 2000]);
			before.release();
		});
	});
});
