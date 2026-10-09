/**
 * How `TimerHandler` routes its queue jobs, and the timer writes the asynchronous sync must not change.
 *
 * - `appSetting.asyncTimerDataSync` is off by default: jobs keep going through the in-memory `embedded-queue`
 *   exactly as before, and no queue file is created.
 * - When it is on, jobs go through the persistent queue (a real SQLite file in a temporary user data folder). A job
 *   that cannot be stored, or a queue that cannot be opened, falls back to the in-memory queue rather than be lost.
 * - Turning the setting back off first runs whatever the asynchronous session left behind.
 * - The offline flags written when the timer starts and stops are the ones offline sync relies on: a session tracked
 *   online but marked "started offline" or "unsynced" would be pushed to the API a second time.
 *
 * Electron, the local database and the activity sources cannot run here, so they are replaced by fakes.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let userData = '';
let appSetting: Record<string, any> = {};

jest.mock(
	'electron',
	() => ({
		app: { getPath: () => userData, getName: () => 'gauzy-test', getVersion: () => '1.0.0' },
		screen: {}
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
		getStore: (key: string) => (key === 'appSetting' ? appSetting : {}),
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

jest.mock('./integrations', () => {
	const service = class {
		save = jest.fn(async () => undefined);
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
			isConnected = false;
			clearAllEvents = jest.fn(async () => undefined);
		}
	};
});

type TimerWrite = Record<string, unknown>;

/** Stands in for the `timers` table; `hold()` keeps the next writes waiting. */
const fakeTimerService = () => {
	const writes: TimerWrite[] = [];
	let held: Promise<void> | null = null;
	let release: () => void = () => undefined;
	return {
		writes,
		update: jest.fn(async (timer: { id?: number; toObject(): TimerWrite }) => {
			if (held) await held;
			writes.push({ id: timer.id, ...timer.toObject() });
		}),
		findLastOne: jest.fn(async () => null),
		hold() {
			held = new Promise<void>((resolve) => (release = resolve));
		},
		release() {
			held = null;
			release();
		}
	};
};

let timerService = fakeTimerService();
const offlineMode = { enabled: false };
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

const audit = { timerAuditInfo: jest.fn(async (_message: string) => undefined), timerAuditError: jest.fn(async (_message: string) => undefined) };
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

/** The persistent queue a handler decided on (null: the in-memory queue). */
const asyncQueueOf = (handler: TimerHandler): Promise<AsyncTimerSyncQueue | null> =>
	(handler as any)._asyncTimerSync ?? Promise.resolve(null);

describe('TimerHandler', () => {
	const handlers: TimerHandler[] = [];
	const newHandler = () => {
		const handler = new TimerHandler();
		handlers.push(handler);
		return handler;
	};

	beforeEach(() => {
		userData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-timer-'));
		appSetting = {};
		offlineMode.enabled = false;
		timerService = fakeTimerService();
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

		it('runs a job it could not store on the in-memory queue rather than lose it', async () => {
			appSetting = { asyncTimerDataSync: true };
			const handler = newHandler();
			await handler.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			const queue = await asyncQueueOf(handler);
			await queue.drain();
			await queue.close();

			await handler.processWithQueue('gauzy-queue', duration(1, 2000), knex);

			expect(audit.timerAuditError).toHaveBeenCalledWith(
				'[processWithQueue] Could not store queue job (type: update-duration-timer), processing it in memory: PersistentQueue is closed'
			);
			expect(embedded.jobs).toHaveLength(1);
			expect(timerService.writes.map((write) => write.duration)).toEqual([1000, 2000]);
		});

		it('with the setting turned back off, first runs what the asynchronous session left behind', async () => {
			appSetting = { asyncTimerDataSync: true };
			const crashed = timerService;
			const first = newHandler();
			crashed.hold();
			await first.processWithQueue('gauzy-queue', duration(1, 1000), knex);
			await first.processWithQueue('gauzy-queue', duration(1, 2000), knex);
			await (await asyncQueueOf(first)).close(20);

			appSetting = {};
			timerService = fakeTimerService();
			const second = newHandler();
			await second.processWithQueue('gauzy-queue', duration(2, 500), knex);

			expect(timerService.writes.map(({ id, duration: ms }) => [id, ms])).toEqual([
				[1, 1000],
				[1, 2000],
				[2, 500]
			]);
			expect(await asyncQueueOf(second)).toBeNull();
			crashed.release();
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
