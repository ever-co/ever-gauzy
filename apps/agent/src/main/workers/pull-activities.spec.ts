/**
 * Two agent defects, on the worker that runs tracking:
 *  - a stop that arrives while a device sleep keeps tracking paused must close the timer the sleep left open and drop
 *    the pause, so waking up cannot resume tracking the person stopped;
 *  - the screenshot interval comes from the organisation's screenshot frequency (it used to be the local default
 *    only), re-read whenever tracking starts and periodically while it runs, and applied to a running capture schedule.
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
const mockEnqueueTimer = jest.fn();
const mockApi = {
	getOrganizationTimerSetting: jest.fn(async (): Promise<unknown> => null),
	timerStatus: jest.fn(),
	stopTimer: jest.fn()
};
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('electron', () => ({ Notification: class Notification {}, screen: {} }));
jest.mock('is-online', () => ({ __esModule: true, default: jest.fn(async () => false) }));
jest.mock('../../environments/environment', () => ({ environment: {} }), { virtual: true });
jest.mock('@gauzy/desktop-activity', () => ({
	ActivityState: { active: 'active', idle: 'idle' },
	ActivityWindow: { getInstance: () => ({}) },
	KbMouseTimer: { getInstance: () => mockTimerModule },
	KeyboardMouseActivityStores: { getInstance: () => ({}) },
	KeyboardMouseEventCounter: {
		getInstance: () => ({
			setKeyboardMouseStatusCallback: jest.fn(),
			startListener: jest.fn(),
			stopListener: jest.fn()
		})
	}
}));
jest.mock('@gauzy/desktop-lib', () => ({
	KbMouseActivityService: class KbMouseActivityService {},
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
	WorkerQueue: { getInstance: () => ({ desktopQueue: { enqueueTimer: mockEnqueueTimer } }) }
}));

import PullActivities from './pull-activities';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Let the settings refresh that starting tracking fires (and does not wait for) finish */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The same under fake timers, where only promise continuations can run */
const settleMicrotasks = async () => {
	for (let i = 0; i < 50; i++) {
		await Promise.resolve();
	}
};

describe('PullActivities', () => {
	let pull: PullActivities;

	beforeEach(() => {
		jest.clearAllMocks();
		for (const key of Object.keys(mockStore)) {
			delete mockStore[key];
		}
		mockStore['auth'] = { token: 'token', user: { id: 'user-1', employee: { id: 'employee-1' } } };
		mockStore['appSetting'] = { timer: { updatePeriod: 10 }, kbMouseTracking: false };
		mockApi.getOrganizationTimerSetting.mockResolvedValue(null);
		pull = new PullActivities();
	});

	afterEach(async () => {
		// Clear the settings refresh interval a running worker keeps
		await pull.stopTracking();
		jest.useRealTimers();
	});

	describe('stop while a device sleep keeps tracking paused', () => {
		it('closes the timer the sleep left open at the moment it paused, and drops the pause', async () => {
			await pull.startTracking();
			await settle();
			const pausedAt = new Date(Date.now() - 60_000);

			// What the sleep handler does
			await pull.stopTracking(true);
			pull.startedPausedDate = pausedAt;
			pull.isPaused = true;
			expect(mockTimerService.update).not.toHaveBeenCalled();

			await pull.stopTracking();

			expect(pull.isPaused).toBe(false);
			expect(pull.startedPausedDate).toBeNull();
			expect(mockTimerService.update).toHaveBeenCalledWith(
				expect.objectContaining({ id: 7, stoppedAt: pausedAt })
			);
			expect(mockEnqueueTimer).toHaveBeenLastCalledWith(
				expect.objectContaining({
					timerId: 7,
					data: expect.objectContaining({ stoppedAt: pausedAt.toISOString(), isStopped: true })
				})
			);
		});

		it('still only pauses (keeping the timer open) when the sleep stops tracking', async () => {
			await pull.startTracking();
			await settle();

			await pull.stopTracking(true);

			expect(pull.running).toBe(false);
			expect(mockTimerService.update).not.toHaveBeenCalled();
		});

		it('does nothing when neither running nor paused', async () => {
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
			mockApi.getOrganizationTimerSetting.mockRejectedValue(new Error('offline'));

			await pull.startTracking();
			await settle();
			await expect(pull.refreshOrganizationSetting()).resolves.toBeUndefined();

			expect(mockTimerModule.setScreenshotInterval).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalled();
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
			await pull.stopTracking(true);

			mockApi.getOrganizationTimerSetting.mockResolvedValue({ screenshotFrequency: 5 });
			await pull.startTracking(true);
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
