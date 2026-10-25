/**
 * Two agent defects, on the worker that runs tracking:
 *  - waking from sleep restarted tracking the person had stopped. Wake-ups now resume only tracking a sleep paused;
 *    sleeps and wake-ups are handled in order, so a repeated wake-up records the sleep once; a stop while paused (even
 *    while the wake-up is recording the sleep) drops the pause, stops the recording and closes the timer where the
 *    recorded sleep ends, so no saved activity outlasts the timer;
 *  - the screenshot interval comes from the organisation's screenshot frequency (it used to be the local default
 *    only), re-read whenever tracking starts and periodically while it runs, applied to a running capture schedule, and
 *    only ever from a response that belongs to the signed-in account, its organisation and the running session.
 *
 * The worker runs for real against an in-memory settings store; the capture modules, the local database services, the
 * API and the queue are stand-ins.
 */
type TStore = Record<string, any>;

const mockStore: TStore = {};
const mockTimerModule = {
	onFlush: jest.fn(),
	setFlushInterval: jest.fn(),
	afkEvent: jest.fn(),
	setTimerStartedCallback: jest.fn(),
	setActiveWindowCallback: jest.fn(),
	setScreenshotInterval: jest.fn(),
	setRandomScreenshotInterval: jest.fn(),
	start: jest.fn(),
	stop: jest.fn()
};
const mockTimerService = {
	todayDurations: jest.fn(async () => 0),
	saveAndReturn: jest.fn(async () => ({ id: 7 })),
	update: jest.fn(async () => undefined),
	findById: jest.fn(async () => ({}))
};
const mockActivityService = {
	saveAndReturn: jest.fn(async (_activity: TStore): Promise<unknown> => ({ id: 1 }))
};
const mockNoActivity = {
	kbPressCount: 0,
	kbSequence: [],
	mouseLeftClickCount: 0,
	mouseRightClickCount: 0,
	mouseMovementsCount: 0,
	mouseEvents: []
};
const mockEnqueueTimer = jest.fn();
const mockEnqueueTimeSlot = jest.fn();
const mockApi = {
	getOrganizationTimerSetting: jest.fn(async (_timeoutMs?: number): Promise<unknown> => null),
	timerStatus: jest.fn(),
	stopTimer: jest.fn()
};
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('electron', () => ({ Notification: class Notification {}, screen: {} }));
jest.mock('is-online', () => ({ __esModule: true, default: jest.fn(async () => false) }));
jest.mock('../../environments/environment', () => ({ environment: {} }), { virtual: true });
jest.mock('@gauzy/desktop-activity', () => ({
	ActivityState: { active: 'active', idle: 'idle' },
	ActivityWindow: { getInstance: () => ({ retrieveAndFlushActivities: () => [] }) },
	KbMouseTimer: { getInstance: () => mockTimerModule },
	KeyboardMouseActivityStores: {
		getInstance: () => ({ defaultValue: mockNoActivity, getAndResetCurrentActivities: () => mockNoActivity })
	},
	KeyboardMouseEventCounter: {
		getInstance: () => ({
			setKeyboardMouseStatusCallback: jest.fn(),
			startListener: jest.fn(),
			stopListener: jest.fn()
		})
	}
}));
jest.mock('@gauzy/desktop-lib', () => ({
	KbMouseActivityService: jest.fn(() => mockActivityService),
	LocalStore: {
		getStore: (key: string) => mockStore[key],
		updateApplicationSetting: (values: TStore) => {
			mockStore['appSetting'] = { ...(mockStore['appSetting'] ?? {}), ...values };
		}
	},
	notifyScreenshot: jest.fn(),
	PowerManagerPreventDisplaySleep: class PowerManagerPreventDisplaySleep {
		start() {}
		stop() {}
	},
	Timer: class Timer {
		constructor(values: TStore) {
			Object.assign(this, values);
		}
	},
	TimerService: jest.fn(() => mockTimerService),
	TranslateService: { instant: (key: string) => key }
}));
jest.mock('../window-manager', () => ({ __esModule: true, default: { getInstance: () => ({}) } }));
jest.mock('../screenshot', () => ({ getScreenshot: jest.fn() }));
jest.mock('../agent-logger', () => ({ AgentLogger: { getInstance: () => mockLogger } }));
jest.mock('../api', () => ({ ApiService: { getInstance: () => mockApi } }));
jest.mock('../queue/worker-queue', () => ({
	WorkerQueue: {
		getInstance: () => ({ desktopQueue: { enqueueTimer: mockEnqueueTimer, enqueueTimeSlot: mockEnqueueTimeSlot } })
	}
}));

import PullActivities from './pull-activities';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const T0 = new Date('2026-10-25T09:00:00.000Z').getTime();

/** `minutes` after T0 */
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

/** Fake only the clock, from T0: timers and promise continuations stay real */
const fakeClock = () =>
	jest.useFakeTimers({
		now: T0,
		doNotFake: [
			'hrtime',
			'nextTick',
			'performance',
			'queueMicrotask',
			'requestAnimationFrame',
			'cancelAnimationFrame',
			'requestIdleCallback',
			'cancelIdleCallback',
			'setImmediate',
			'clearImmediate',
			'setInterval',
			'clearInterval',
			'setTimeout',
			'clearTimeout'
		]
	});

/** Let work the worker fires (and does not wait for) finish */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The same under fake timers, where only promise continuations can run */
const settleMicrotasks = async () => {
	for (let i = 0; i < 50; i++) {
		await Promise.resolve();
	}
};

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
}

/** The idle (sleep) activities saved, in order */
const idleActivities = () =>
	mockActivityService.saveAndReturn.mock.calls
		.map(([activity]) => activity)
		.filter((a) => a.activityState === 'idle');

describe('PullActivities', () => {
	let pull: PullActivities;

	beforeEach(() => {
		jest.clearAllMocks();
		for (const key of Object.keys(mockStore)) {
			delete mockStore[key];
		}
		mockStore['auth'] = {
			token: 'token',
			user: { id: 'user-1', employee: { id: 'employee-1', organizationId: 'org-1', tenantId: 'tenant-1' } }
		};
		mockStore['appSetting'] = { timer: { updatePeriod: 10 }, kbMouseTracking: false };
		mockApi.getOrganizationTimerSetting.mockResolvedValue(null);
		pull = new PullActivities();
	});

	afterEach(async () => {
		// Clear the settings refresh interval a running worker keeps
		await pull.stopTracking();
		jest.useRealTimers();
	});

	describe('sleep and wake-up', () => {
		it('leaves tracking stopped after a wake-up when the person had stopped it before the sleep', async () => {
			await pull.startTracking();
			await pull.stopTracking();
			jest.clearAllMocks();

			await pull.pauseForSleep();
			await pull.resumeAfterSleep();

			expect(pull.running).toBe(false);
			expect(pull.isPaused).toBe(false);
			expect(mockTimerModule.start).not.toHaveBeenCalled();
			expect(mockTimerService.saveAndReturn).not.toHaveBeenCalled();
			expect(idleActivities()).toHaveLength(0);
		});

		it('leaves tracking stopped after a wake-up when it never ran', async () => {
			await pull.pauseForSleep();
			await pull.resumeAfterSleep();

			expect(pull.running).toBe(false);
			expect(mockTimerModule.start).not.toHaveBeenCalled();
		});

		it('resumes tracking a sleep paused, on the same timer, with the sleep recorded as idle time', async () => {
			fakeClock();
			await pull.startTracking();
			await settleMicrotasks();
			jest.setSystemTime(at(5));

			await pull.pauseForSleep();
			expect(pull.isPaused).toBe(true);
			expect(pull.running).toBe(false);
			expect(mockTimerService.update).not.toHaveBeenCalled();

			jest.setSystemTime(at(30));
			await pull.resumeAfterSleep();

			expect(idleActivities().map((a) => [a.timeStart, a.timeEnd])).toEqual([
				[at(5), at(15)],
				[at(15), at(25)],
				[at(25), at(30)]
			]);
			expect(idleActivities().every((a) => a.timerId === 7)).toBe(true);
			expect(pull.running).toBe(true);
			expect(pull.isPaused).toBe(false);
			expect(mockTimerService.saveAndReturn).toHaveBeenCalledTimes(1);
			expect(mockTimerService.update).not.toHaveBeenCalled();
		});

		it('records the sleep once when the wake-up is reported twice', async () => {
			fakeClock();
			await pull.startTracking();
			await settleMicrotasks();
			await pull.pauseForSleep();
			jest.setSystemTime(at(25));

			await Promise.all([pull.resumeAfterSleep(), pull.resumeAfterSleep()]);

			expect(idleActivities()).toHaveLength(3);
			expect(mockTimerModule.start).toHaveBeenCalledTimes(2);
			expect(pull.running).toBe(true);
		});

		it('closes the timer at the pause moment when the person stops tracking a sleep paused', async () => {
			fakeClock();
			await pull.startTracking();
			await settleMicrotasks();
			jest.setSystemTime(at(5));
			await pull.pauseForSleep();
			jest.setSystemTime(at(20));

			await pull.stopTracking();

			expect(pull.isPaused).toBe(false);
			expect(mockTimerService.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, stoppedAt: at(5) }));
			expect(mockEnqueueTimer).toHaveBeenLastCalledWith(
				expect.objectContaining({
					timerId: 7,
					data: expect.objectContaining({ stoppedAt: at(5).toISOString(), isStopped: true })
				})
			);

			await pull.resumeAfterSleep();
			expect(pull.running).toBe(false);
			expect(idleActivities()).toHaveLength(0);
		});

		it('stops recording the sleep and ends the timer there when the person stops during the wake-up', async () => {
			fakeClock();
			await pull.startTracking();
			await settleMicrotasks();
			await pull.pauseForSleep();
			jest.setSystemTime(at(25));
			const firstChunk = deferred<unknown>();
			mockActivityService.saveAndReturn.mockImplementationOnce(() => firstChunk.promise);

			const waking = pull.resumeAfterSleep();
			await settleMicrotasks();
			expect(mockActivityService.saveAndReturn).toHaveBeenCalledTimes(1);

			await pull.stopTracking();
			// Closed where the chunk being written ends
			expect(mockTimerService.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, stoppedAt: at(10) }));

			firstChunk.resolve({ id: 1 });
			await waking;

			expect(idleActivities().map((a) => a.timeEnd)).toEqual([at(10)]);
			expect(mockEnqueueTimeSlot).toHaveBeenCalledTimes(1);
			expect(pull.running).toBe(false);
			expect(pull.isPaused).toBe(false);
		});

		it('keeps a newer sleep paused when an older wake-up finishes late', async () => {
			fakeClock();
			await pull.startTracking();
			await settleMicrotasks();
			await pull.pauseForSleep();
			jest.setSystemTime(at(25));
			const firstChunk = deferred<unknown>();
			mockActivityService.saveAndReturn.mockImplementationOnce(() => firstChunk.promise);
			const waking = pull.resumeAfterSleep();
			await settleMicrotasks();

			// The person stops and restarts tracking, then the device sleeps again, all before the wake-up finishes
			await pull.stopTracking();
			await pull.startTracking();
			const sleepingAgain = pull.pauseForSleep();
			firstChunk.resolve({ id: 1 });
			await Promise.all([waking, sleepingAgain]);

			expect(pull.isPaused).toBe(true);
			expect(pull.running).toBe(false);

			jest.setSystemTime(at(40));
			await pull.resumeAfterSleep();
			expect(pull.running).toBe(true);
			expect(pull.isPaused).toBe(false);
		});

		it('still only pauses (keeping the timer open) when the sleep stops tracking', async () => {
			await pull.startTracking();
			await settle();

			await pull.pauseForSleep();

			expect(pull.running).toBe(false);
			expect(mockTimerService.update).not.toHaveBeenCalled();
		});

		it('does nothing on stop when neither running nor paused', async () => {
			await pull.stopTracking();

			expect(mockTimerService.update).not.toHaveBeenCalled();
			expect(mockEnqueueTimer).not.toHaveBeenCalled();
		});
	});

	describe("organisation's screenshot frequency", () => {
		it("applies the organisation's frequency to the running capture schedule and stores it", async () => {
			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: '3', enforced: false });

			await pull.startTracking();
			await settle();

			// The session starts on the stored period, then takes the organisation's
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenNthCalledWith(1, 600);
			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(1);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(180);
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(3);
		});

		it('gives the settings request a deadline', async () => {
			await pull.startTracking();
			await settle();

			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledWith(30_000);
		});

		it('starts the next session on the stored organisation frequency', async () => {
			mockStore['appSetting'].timer.updatePeriod = 1;

			await pull.startTracking();
			await settle();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(60);
		});

		it('keeps the current interval when the organisation has no frequency', async () => {
			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: null });

			await pull.startTracking();
			await settle();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenCalledTimes(1);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(600);
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(10);
		});

		it('falls back to five minutes when no period is stored at all', async () => {
			mockStore['appSetting'] = { kbMouseTracking: false };

			await pull.startTracking();
			await settle();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(300);
		});

		it('keeps the current interval when the settings cannot be read', async () => {
			mockApi.getOrganizationTimerSetting.mockRejectedValue(new Error('timed out'));

			await pull.startTracking();
			await settle();
			await expect(pull.refreshOrganizationSetting()).resolves.toBeUndefined();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it('drops settings that belong to another organisation than the agent signed in to', async () => {
			mockApi.getOrganizationTimerSetting.mockResolvedValue({ id: 'org-2', screenshotFrequency: 1 });

			await pull.startTracking();
			await settle();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenCalledTimes(1);
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(10);
		});

		it("never applies an earlier account's settings, nor lets its late request block the next one", async () => {
			const forA = deferred<unknown>();
			const forB = deferred<unknown>();
			mockApi.getOrganizationTimerSetting
				.mockImplementationOnce(() => forA.promise)
				.mockImplementationOnce(() => forB.promise);
			await pull.startTracking();

			// A signs out, B signs in and tracking starts for B while A's request is still pending
			await pull.stopTracking();
			mockStore['auth'] = {
				token: 'token-b',
				user: { id: 'user-2', employee: { id: 'employee-2', organizationId: 'org-b', tenantId: 'tenant-1' } }
			};
			await pull.startTracking();
			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);

			forA.resolve({ id: 'org-1', screenshotFrequency: 1 });
			await settle();
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(10);
			// A's request settling did not clear B's: a refresh now joins B's pending request
			void pull.refreshOrganizationSetting();
			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);

			forB.resolve({ id: 'org-b', screenshotFrequency: 5 });
			await settle();
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(5);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(300);
		});

		it('drops settings requested for an earlier tracking session', async () => {
			const forFirst = deferred<unknown>();
			mockApi.getOrganizationTimerSetting
				.mockImplementationOnce(() => forFirst.promise)
				.mockResolvedValueOnce({ id: 'org-1', screenshotFrequency: 3 });
			await pull.startTracking();
			await pull.stopTracking();

			await pull.startTracking();
			await settle();
			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(180);

			forFirst.resolve({ id: 'org-1', screenshotFrequency: 1 });
			await settle();
			expect(mockStore['appSetting'].timer.updatePeriod).toBe(3);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(180);
		});

		it('re-reads the settings while tracking runs, and stops re-reading once it stops', async () => {
			jest.useFakeTimers();
			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: 10 });
			await pull.startTracking();
			await settleMicrotasks();
			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(1);

			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: 1 });
			jest.advanceTimersByTime(FIFTEEN_MINUTES);
			await settleMicrotasks();

			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(60);

			await pull.stopTracking();
			jest.advanceTimersByTime(FIFTEEN_MINUTES * 4);
			await settleMicrotasks();

			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);
		});

		it('re-reads the settings when tracking resumes after a sleep', async () => {
			await pull.startTracking();
			await settle();
			await pull.pauseForSleep();

			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: 5 });
			await pull.resumeAfterSleep();
			await settle();

			expect(mockApi.getOrganizationTimerSetting).toHaveBeenCalledTimes(2);
			expect(mockTimerModule.setScreenshotInterval).toHaveBeenLastCalledWith(300);
		});

		it('does not read the settings when signed out', async () => {
			mockStore['auth'] = null;

			await pull.refreshOrganizationSetting();

			expect(mockApi.getOrganizationTimerSetting).not.toHaveBeenCalled();
		});
	});
});
