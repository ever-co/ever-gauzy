/**
 * How `TimerHandler` routes its queue jobs, and the timer writes the asynchronous sync must not change.
 *
 * - `appSetting.asyncTimerDataSync` is off by default: jobs keep going through the in-memory `embedded-queue`
 *   exactly as before, and no queue file is created.
 * - When it is on, jobs go through the persistent queue (a real SQLite file in a temporary user data folder). A job
 *   that cannot be stored, or a queue that cannot be opened, falls back to the in-memory queue rather than be lost —
 *   after the stored jobs ahead of it, so it cannot overtake them.
 * - Turning the setting back off keeps running whatever the asynchronous session left behind, ahead of new jobs,
 *   until none is left; only then does the session move to the in-memory queue.
 * - A time slot is built only once the activity saved before it has been written, so it lands in the right slot.
 * - A stored job never marks a timer unsynced: offline sync may have uploaded the timer by the time the job runs.
 * - The offline flags written when the timer starts and stops are the ones offline sync relies on: a session tracked
 *   online but marked "started offline" or "unsynced" would be pushed to the API a second time.
 *
 * Electron, the local database and the activity sources cannot run here, so they are replaced by fakes.
 */
import * as fs from 'fs';
import * as moment from 'moment';
import * as os from 'os';
import * as path from 'path';

let userData = '';
let appSetting: Record<string, any> = {};

jest.mock(
	'electron',
	() => ({
		app: { getPath: () => userData, getName: () => 'gauzy-test', getVersion: () => '1.0.0' },
		screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) }
	}),
	{ virtual: true }
);

/** The in-memory queue of the default path: runs each job as soon as it is created. */
const embedded = {
	createQueue: jest.fn(),
	jobs: [] as Array<{ type: string; data: unknown }>,
	processor: null as null | ((job: { data: unknown }) => Promise<void>)
};
jest.mock(
	'embedded-queue',
	() => ({
		Queue: { createQueue: (options: unknown) => embedded.createQueue(options) },
		Event: { Complete: 'complete' }
	}),
	{ virtual: true }
);

jest.mock('./desktop-store', () => ({
	LocalStore: {
		getStore: (key: string) => {
			if (key === 'appSetting') return appSetting;
			if (key === 'project') return { aw: { host: 'http://localhost:5600', isAw: true } };
			return {};
		},
		updateApplicationSetting: jest.fn(),
		beforeRequestParams: () => ({})
	}
}));

jest.mock('./desktop-active-window', () => ({
	DesktopActiveWindow: class {
		active = false;
		on = jest.fn();
		start = jest.fn();
		stop = jest.fn();
		updateActivities = jest.fn();
	}
}));

jest.mock('@gauzy/desktop-activity', () => ({
	...jest.requireActual('@gauzy/desktop-activity'),
	DesktopEventCounter: class {
		// Long enough for every time slot to reset the activity tables after reading them.
		intervalDuration = 3_600;
		keyboardPercentage = 0;
		mousePercentage = 0;
		systemPercentage = 0;
		start = jest.fn();
		stop = jest.fn();
		reset = jest.fn();
	}
}));

jest.mock('./desktop-notifier', () => ({
	__esModule: true,
	default: class {
		timerActionNotification = jest.fn();
	}
}));
jest.mock('./desktop-screenshot', () => ({ detectActiveWindow: jest.fn(), getScreenshot: jest.fn() }));
jest.mock('./desktop-wakatime', () => ({ metaData: { getActivity: jest.fn(async () => []), removeActivity: jest.fn() } }));

/** Stands in for the ActivityWatch event tables: saved by queue jobs, read and reset when a time slot is built. */
const activityTable = {
	rows: [] as Array<{ eventId: number; timerId: number }>,
	held: null as Promise<void> | null
};
jest.mock('./integrations', () => {
	const service = class {
		save = jest.fn(async (events: Array<{ eventId: number; timerId: number }>) => {
			if (activityTable.held) await activityTable.held;
			activityTable.rows.push(...events);
		});
		clear = jest.fn(async () => undefined);
	};
	return {
		ActivityWatchEventTableList: {
			AFK: 'afk_events',
			WINDOW: 'window_events',
			CHROME: 'chrome_events',
			FIREFOX: 'firefox_events',
			EDGE: 'edge_events'
		},
		ActivityWatchWindowService: service,
		ActivityWatchAfkService: service,
		ActivityWatchChromeService: service,
		ActivityWatchFirefoxService: service,
		ActivityWatchEdgeService: service,
		ActivityWatchEventManager: { collectActivities: jest.fn() },
		ActivityWatchService: class {
			isConnected = true;
			clearAllEvents = jest.fn(async () => {
				activityTable.rows = [];
			});
			activities = jest.fn(async (timerId: number) =>
				activityTable.rows.filter((row) => row.timerId === timerId).map(({ eventId }) => ({ eventId }))
			);
			activityPercentage = jest.fn(async () => ({ keyboardPercentage: 0, mousePercentage: 0, systemPercentage: 0 }));
		}
	};
});

type TimerWrite = Record<string, unknown>;

/** Stands in for the `timers` table. `hold(which)` keeps the matching writes waiting until `release()`. */
const fakeTimerService = () => {
	let writes: TimerWrite[] = [];
	let held: Promise<void> | null = null;
	let holds: (write: TimerWrite) => boolean = () => false;
	let release: () => void = () => undefined;
	return {
		writes,
		update: jest.fn(async (timer: { id?: number; toObject(): TimerWrite }) => {
			const write = { id: timer.id, ...timer.toObject() };
			if (held && holds(write)) await held;
			writes.push(write);
		}),
		findLastOne: jest.fn(async () => null),
		hold(which: (write: TimerWrite) => boolean = () => true) {
			holds = which;
			held = new Promise<void>((resolve) => (release = resolve));
		},
		release() {
			held = null;
			release();
		},
		/** The `synced` value timer `id` ends up with. */
		syncedOf(id: number) {
			return writes.filter((write) => write.id === id && write.synced !== undefined).at(-1)?.synced;
		}
	};
};

let timerService = fakeTimerService();
const offlineMode = { enabled: false, connectivity: jest.fn(async () => undefined) };
jest.mock('./offline', () => ({
	DesktopOfflineModeHandler: {
		get instance() {
			return offlineMode;
		}
	},
	Timer: jest.requireActual('./offline/models/timer.model').Timer,
	TimerService: jest.fn(() => timerService),
	UserService: jest.fn(() => ({ retrieve: jest.fn(async () => ({ employeeId: 'employee-1' })) }))
}));

jest.mock('@gauzy/desktop-core', () => ({ logger: { info: jest.fn() } }));

const audit = {
	timerAuditInfo: jest.fn(async (_message: string) => undefined),
	timerAuditError: jest.fn(async (_message: string) => undefined)
};
jest.mock('./audit', () => ({ AuditLogHandler: { getInstance: () => audit } }));

jest.mock('@gauzy/contracts', () => ({
	ActivityType: { APP: 'APP', URL: 'URL' },
	TimeLogSourceEnum: { DESKTOP: 'DESKTOP' },
	TimerSyncStateEnum: { PENDING: 'PENDING', SYNCED: 'SYNCED' }
}));

import TimerHandler from './desktop-timer';
import { ASYNC_TIMER_SYNC_QUEUE_FILE, AsyncTimerSyncQueue } from './queues/async-timer-sync-queue';

const knex = { name: 'knex' } as any;
const window = { webContents: { send: jest.fn() } } as any;
const duration = (id: number, ms: number) => ({ type: 'update-duration-timer', data: { id, duration: ms } });
const windowEvents = (timerId: number, ...eventIds: number[]) => ({
	type: 'window_events',
	data: eventIds.map((eventId) => ({ eventId, timerId }))
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The persistent queue a handler uses right now (null: the in-memory queue). */
const asyncQueueOf = (handler: TimerHandler): Promise<AsyncTimerSyncQueue | null> =>
	(handler as any)._asyncTimerSync ?? Promise.resolve(null);

describe('TimerHandler', () => {
	let handlers: TimerHandler[] = [];
	const newHandler = () => {
		const handler = new TimerHandler();
		handlers.push(handler);
		return handler;
	};

	/** A previous asynchronous session that died with `jobs` still stored (the first one mid-write). */
	const crashedSession = async (...jobs: Array<{ type: string; data: unknown }>) => {
		const setting = appSetting;
		const timers = timerService;
		appSetting = { asyncTimerDataSync: true };
		timerService = fakeTimerService();
		// The stored jobs never get written; whatever is written before they are stored still is.
		timerService.hold((write) => write.duration !== undefined);
		const crashed = newHandler();
		for (const job of jobs) {
			await crashed.processWithQueue('gauzy-queue', job, knex);
		}
		await (await asyncQueueOf(crashed)).close(20);
		const stuck = timerService;
		appSetting = setting;
		timerService = timers;
		return stuck;
	};

	beforeEach(() => {
		userData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-timer-'));
		appSetting = {};
		offlineMode.enabled = false;
		timerService = fakeTimerService();
		activityTable.rows = [];
		activityTable.held = null;
		embedded.jobs = [];
		embedded.processor = null;
		embedded.createQueue.mockReset().mockImplementation(async () => ({
			process: (_name: string, processor: (job: { data: unknown }) => Promise<void>) => (embedded.processor = processor),
			on: jest.fn(),
			createJob: async (job: { type: string; data: unknown }) => {
				embedded.jobs.push(job);
				await embedded.processor({ data: job.data });
			}
		}));
		audit.timerAuditInfo.mockClear();
		audit.timerAuditError.mockClear();
		window.webContents.send.mockClear();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		for (const handler of handlers.splice(0)) {
			clearInterval(handler.intervalTimer);
			clearInterval(handler.intervalUpdateTime);
			await (await asyncQueueOf(handler))?.close(50);
		}
		jest.useRealTimers();
		jest.restoreAllMocks();
		fs.rmSync(userData, { recursive: true, force: true });
	});

	describe('processWithQueue', () => {
		it.each([
			['absent', {}],
			['false', { asyncTimerDataSync: false }]
		])('keeps the in-memory queue when the setting is %s', async (_label, setting) => {
			appSetting = setting;
			const handler = newHandler();

			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			await handler.processWithQueue('gauzy-queue', duration(1, 2000), knex);

			expect(embedded.createQueue).toHaveBeenCalledTimes(1);
			expect(embedded.createQueue).toHaveBeenCalledWith({ inMemoryOnly: true });
			expect(embedded.jobs.map((job) => job.type)).toEqual(['gauzy-queue-gauzy-test', 'gauzy-queue-gauzy-test']);
			expect(timerService.writes.map((write) => write.duration)).toEqual([1000, 2000]);
			expect(await asyncQueueOf(handler)).toBeNull();
			expect(fs.readdirSync(userData)).toEqual([]);
		});

		it('still audits and swallows a failing job on the in-memory queue', async () => {
			const handler = newHandler();
			timerService.update.mockRejectedValueOnce(new Error('disk I/O error'));

			await expect(handler.processWithQueue('gauzy-queue', duration(1, 1000), knex)).resolves.toBeUndefined();

			expect(audit.timerAuditError).toHaveBeenCalledWith(
				'[ProcessQueueMessage] Failed to process queue job (type: update-duration-timer): disk I/O error'
			);
		});

		it('sends jobs through the persistent queue when the setting is on', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();

			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			await handler.processWithQueue('gauzy-queue', { type: 'update-timer-time-slot', data: { id: 1, timeSlotId: 'slot-1' } }, knex);
			await handler.processWithQueue('gauzy-queue', duration(1, 2000), knex);
			const queue = await asyncQueueOf(handler);

			expect(queue).toBeInstanceOf(AsyncTimerSyncQueue);
			expect(await queue.drain()).toBe(true);
			expect(embedded.createQueue).not.toHaveBeenCalled();
			expect(fs.existsSync(path.join(userData, ASYNC_TIMER_SYNC_QUEUE_FILE))).toBe(true);
			expect(timerService.writes).toEqual([
				expect.objectContaining({ id: 1, duration: 1000, synced: undefined }),
				expect.objectContaining({ id: 1, timeslotId: 'slot-1' }),
				expect.objectContaining({ id: 1, duration: 2000, synced: undefined })
			]);
		});

		it('reads the setting once, so a session never mixes the two queues', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();
			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);

			appSetting = { asyncTimerDataSync: false };
			await handler.processWithQueue('gauzy-queue', duration(1, 2000), knex);

			expect(await (await asyncQueueOf(handler)).drain()).toBe(true);
			expect(embedded.createQueue).not.toHaveBeenCalled();
			expect(timerService.writes.map((write) => write.duration)).toEqual([1000, 2000]);
		});

		it('falls back to the in-memory queue when the persistent queue cannot be opened', async () => {
			appSetting = { asyncTimerDataSync: true };
			const root = userData;
			userData = path.join(root, 'missing', 'folder');
			const handler = newHandler();

			try {
				await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			} finally {
				userData = root;
			}

			expect(audit.timerAuditError).toHaveBeenCalledWith(
				expect.stringContaining('[processWithQueue] Persistent timer queue unavailable, using the in-memory queue')
			);
			expect(embedded.jobs).toHaveLength(1);
			expect(timerService.writes.map((write) => write.duration)).toEqual([1000]);
		});

		it('runs a job it could not store on the in-memory queue, after the stored jobs ahead of it', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();
			timerService.hold((write) => write.duration === 1000);
			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			const queue = await asyncQueueOf(handler);
			jest.spyOn(queue, 'processWithQueue').mockRejectedValueOnce(new Error('SQLITE_FULL: database or disk is full'));

			const fallback = handler.processWithQueue('gauzy-queue', duration(1, 2000), knex);
			await sleep(50);
			expect(timerService.writes).toEqual([]);
			timerService.release();
			await fallback;

			expect(audit.timerAuditError).toHaveBeenCalledWith(
				'[processWithQueue] Could not store queue job (type: update-duration-timer), processing it in memory: SQLITE_FULL: database or disk is full'
			);
			expect(embedded.jobs).toHaveLength(1);
			expect(timerService.writes.map((write) => write.duration)).toEqual([1000, 2000]);
		});

		it('with the setting turned back off, keeps running what the asynchronous session left behind — however long it takes — ahead of new jobs, then moves to the in-memory queue', async () => {
			const stuck = await crashedSession(duration(1, 1000), duration(1, 2000));
			stuck.release();
			// The jobs left behind take longer than any fixed window (here: until released).
			timerService.hold((write) => write.id === 1);
			const handler = newHandler();

			await handler.processWithQueue('gauzy-queue', duration(2, 500), knex);
			await sleep(100);
			expect(timerService.writes).toEqual([]);
			expect(embedded.createQueue).not.toHaveBeenCalled();

			timerService.release();
			expect(await (await asyncQueueOf(handler)).drain()).toBe(true);
			expect(timerService.writes.map(({ id, duration: ms }) => [id, ms])).toEqual([
				[1, 1000],
				[1, 2000],
				[2, 500]
			]);

			// Nothing is left behind any more: the rest of the session uses the in-memory queue.
			await handler.processWithQueue('gauzy-queue', duration(2, 1500), knex);
			expect(embedded.jobs).toHaveLength(1);
			expect(await asyncQueueOf(handler)).toBeNull();
			expect(timerService.writes.at(-1)).toMatchObject({ id: 2, duration: 1500 });
		});
	});

	describe('offline sync', () => {
		it('does not mark a timer unsynced again when a duration stored offline runs after the timer was uploaded', async () => {
			offlineMode.enabled = true;
			const stuck = await crashedSession(duration(1, 1000));
			stuck.release();

			// Next start, online: offline sync uploads timer 1 before the stored job gets its turn…
			offlineMode.enabled = false;
			appSetting = { asyncTimerDataSync: true };
			timerService.writes.push({ id: 1, synced: true });
			// …which comes when the first job of the session opens the queue.
			const handler = newHandler();
			await handler.processWithQueue('gauzy-queue', windowEvents(2, 10), knex);
			expect(await (await asyncQueueOf(handler)).drain()).toBe(true);

			expect(timerService.writes).toContainEqual(expect.objectContaining({ id: 1, duration: 1000 }));
			expect(timerService.syncedOf(1)).toBe(true);
		});

		it('still marks a timer unsynced as soon as a duration is queued offline', async () => {
			appSetting = { asyncTimerDataSync: true };
			offlineMode.enabled = true;
			timerService.hold((write) => write.duration !== undefined);
			const handler = newHandler();

			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);

			// Written before the queued duration, which is still waiting.
			expect(timerService.writes).toEqual([expect.objectContaining({ id: 1, synced: false })]);
			timerService.release();
			expect(await (await asyncQueueOf(handler)).drain()).toBe(true);
			expect(timerService.writes.at(-1)).toMatchObject({ id: 1, duration: 1000 });
			expect(timerService.writes.at(-1).synced).toBeUndefined();
		});
	});

	describe('time slots', () => {
		it('puts the activity saved before a time slot into that slot, not the next one', async () => {
			appSetting = {
				asyncTimerDataSync: true,
				SCREENSHOTS_ENGINE_METHOD: 'ElectronDesktopCapturer',
				timer: { updatePeriod: 1 }
			};
			const handler = newHandler();
			handler.lastTimer = { id: 7 };
			let release: () => void = () => undefined;
			activityTable.held = new Promise<void>((resolve) => (release = resolve));
			await handler.processWithQueue('gauzy-queue', windowEvents(7, 1, 2), knex);

			const slot = handler.getAllActivities(knex, moment().subtract(1, 'minute'));
			await sleep(50);
			activityTable.held = null;
			release();

			expect((await slot).activities).toEqual([{ eventId: 1 }, { eventId: 2 }]);
			const next = await handler.getAllActivities(knex, moment());
			expect(next.activities).toEqual([]);
		});
	});

	describe('quitting', () => {
		it('applies the stored jobs and releases the queue when the timer stops to quit; later jobs use the in-memory queue', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();
			handler.lastTimer = { id: 1 };
			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			const queue = await asyncQueueOf(handler);

			await handler.stopTimer(null, window, knex, true);

			expect(queue.isClosed).toBe(true);
			expect(timerService.writes).toContainEqual(expect.objectContaining({ id: 1, duration: 1000 }));
			await handler.processWithQueue('gauzy-queue', { type: 'update-timer-time-slot', data: { id: 1, timeSlotId: 'slot-9' } }, knex);
			expect(embedded.jobs).toHaveLength(1);
			expect(timerService.writes.at(-1)).toMatchObject({ id: 1, timeslotId: 'slot-9' });
			expect(audit.timerAuditError).not.toHaveBeenCalled();
		});

		it('keeps the queue open when the timer stops without quitting', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();
			handler.lastTimer = { id: 1 };
			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);

			await handler.stopTimer(null, window, knex, false);

			expect((await asyncQueueOf(handler)).isClosed).toBe(false);
		});
	});

	describe('timer writes that offline sync relies on', () => {
		it.each([
			[false, { synced: true, isStartedOffline: false }],
			[true, { synced: false, isStartedOffline: true }]
		])('stamps the random-screenshot start (offline: %s) with %o', async (offline, flags) => {
			appSetting = { randomScreenshotTime: true, timer: { updatePeriod: 5 } };
			offlineMode.enabled = offline;
			const handler = newHandler();
			handler.lastTimer = { id: 7 };

			await handler.collectActivities(null, knex, window);

			expect(timerService.writes).toEqual([expect.objectContaining({ id: 7, ...flags })]);
		});

		it('stops the per-second duration updates when the timer stops, and stamps the stop with the offline flags', async () => {
			jest.useFakeTimers();
			appSetting = { timer: { updatePeriod: 5 } };
			const handler = newHandler();
			handler.lastTimer = { id: 7 };
			const queued = jest.spyOn(handler, 'processWithQueue').mockResolvedValue(undefined);

			await handler.collectActivities(null, knex, window);
			jest.advanceTimersByTime(3_000);
			expect(queued).toHaveBeenCalledTimes(3);
			expect(queued).toHaveBeenLastCalledWith('gauzy-queue', expect.objectContaining({ type: 'update-duration-timer' }), knex);

			await handler.stopTimerIntervalPeriod();
			jest.advanceTimersByTime(10_000);

			expect(queued).toHaveBeenCalledTimes(3);
			expect(timerService.writes).toEqual([
				expect.objectContaining({ id: 7, synced: true, isStoppedOffline: false, stopSyncState: 'PENDING' })
			]);
		});
	});
});
