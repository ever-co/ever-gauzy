/**
 * A stop that arrives while a device sleep keeps tracking paused must close the timer the sleep left open and drop the
 * pause, so waking up cannot resume tracking the person stopped.
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

/** Let pending work finish */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PullActivities', () => {
	let pull: PullActivities;

	beforeEach(() => {
		jest.clearAllMocks();
		for (const key of Object.keys(mockStore)) {
			delete mockStore[key];
		}
		mockStore['auth'] = { token: 'token', user: { id: 'user-1', employee: { id: 'employee-1' } } };
		mockStore['appSetting'] = { timer: { updatePeriod: 10 }, kbMouseTracking: false };
		pull = new PullActivities();
	});

	afterEach(async () => {
		await pull.stopTracking();
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
});
