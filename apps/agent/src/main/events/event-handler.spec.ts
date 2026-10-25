/**
 * The agent restarted tracking whenever the device woke from sleep, even when the person had stopped it: the resume
 * handler started tracking unconditionally, and with nothing paused it started a brand-new timer. Waking up now resumes
 * only tracking that the sleep paused.
 *
 * The handler is built with stand-ins for the workers, windows and libraries it reaches; the pause/resume state lives
 * on a fake `PullActivities` that behaves like the real one (`stopTracking(true)` pauses, `stopTracking()` stops and
 * drops a pause, `startTracking()` starts).
 */
const mockPullActivities = {
	running: false,
	isPaused: false,
	startedPausedDate: null as Date | null,
	updateAppUserAuth: jest.fn(),
	recordIdleTime: jest.fn(async () => undefined),
	startTracking: jest.fn(async (_isResume?: boolean) => {
		mockPullActivities.running = true;
	}),
	stopTracking: jest.fn(async (isPaused = false) => {
		mockPullActivities.running = false;
		if (!isPaused) {
			mockPullActivities.isPaused = false;
			mockPullActivities.startedPausedDate = null;
		}
	})
};

jest.mock('electron', () => ({ app: { quit: jest.fn() } }));
jest.mock('@gauzy/desktop-core', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@gauzy/desktop-lib', () => ({
	AppError: class AppError extends Error {},
	DesktopDialog: class DesktopDialog {},
	DesktopUpdater: class DesktopUpdater {
		cancel() {}
	},
	TranslateService: { instant: (key: string) => key }
}));
jest.mock('../workers/pull-activities', () => ({
	__esModule: true,
	default: { getInstance: () => mockPullActivities }
}));
jest.mock('../workers/push-activities', () => ({
	__esModule: true,
	default: { getInstance: () => ({ stopPooling: jest.fn() }) }
}));
jest.mock('../window-manager', () => ({ __esModule: true, default: { getInstance: () => ({}) } }));
jest.mock('./tray-notify', () => ({ TrayNotify: { getInstance: () => ({ updateTrayTimerStatus: jest.fn() }) } }));
jest.mock('../util', () => ({
	getAuthConfig: () => ({ token: 'token', user: { id: 'user-1', employee: { id: 'employee-1' } } }),
	delaySync: async () => true,
	updateAgentSetting: jest.fn(),
	getAppSetting: () => ({}),
	getInitialConfig: () => ({})
}));

import EventHandler from './event-handler';
import { MAIN_EVENT_TYPE } from '../../constant';

describe('EventHandler — wake from sleep', () => {
	let handler: EventHandler;

	const sleep = () => handler.handleEvent({ type: MAIN_EVENT_TYPE.ACTIVITY_PAUSED });
	const wake = () => handler.handleEvent({ type: MAIN_EVENT_TYPE.ACTIVITY_RESUME });
	const stopByPerson = () => handler.handleEvent({ type: MAIN_EVENT_TYPE.STOP_TIMER });

	beforeEach(() => {
		jest.clearAllMocks();
		Object.assign(mockPullActivities, { running: false, isPaused: false, startedPausedDate: null });
		handler = new EventHandler();
	});

	it('leaves tracking stopped after a wake-up when the person had stopped it before the sleep', async () => {
		mockPullActivities.running = true;
		await stopByPerson();
		expect(mockPullActivities.running).toBe(false);

		await sleep();
		await wake();

		expect(mockPullActivities.startTracking).not.toHaveBeenCalled();
		expect(mockPullActivities.recordIdleTime).not.toHaveBeenCalled();
		expect(mockPullActivities.running).toBe(false);
	});

	it('leaves tracking stopped after a wake-up when it never ran', async () => {
		await sleep();
		await wake();

		expect(mockPullActivities.startTracking).not.toHaveBeenCalled();
		expect(mockPullActivities.running).toBe(false);
	});

	it('resumes tracking that was running when the device went to sleep, continuing the same timer', async () => {
		mockPullActivities.running = true;

		await sleep();
		expect(mockPullActivities.stopTracking).toHaveBeenCalledWith(true);
		expect(mockPullActivities.isPaused).toBe(true);
		expect(mockPullActivities.startedPausedDate).toBeInstanceOf(Date);

		await wake();

		expect(mockPullActivities.recordIdleTime).toHaveBeenCalledTimes(1);
		expect(mockPullActivities.startTracking).toHaveBeenCalledTimes(1);
		expect(mockPullActivities.startTracking).toHaveBeenCalledWith(true);
		expect(mockPullActivities.running).toBe(true);
		expect(mockPullActivities.isPaused).toBe(false);
		expect(mockPullActivities.startedPausedDate).toBeNull();
	});

	it('does not resume tracking the person stopped while the sleep kept it paused', async () => {
		mockPullActivities.running = true;
		await sleep();
		await stopByPerson();

		await wake();

		expect(mockPullActivities.startTracking).not.toHaveBeenCalled();
		expect(mockPullActivities.running).toBe(false);
	});

	it('does not resume when the person stops tracking while the sleep time is being recorded', async () => {
		mockPullActivities.running = true;
		await sleep();
		mockPullActivities.recordIdleTime.mockImplementationOnce(async () => {
			await stopByPerson();
		});

		await wake();

		expect(mockPullActivities.startTracking).not.toHaveBeenCalled();
		expect(mockPullActivities.running).toBe(false);
	});

	it('ignores a second wake-up for the same sleep', async () => {
		mockPullActivities.running = true;
		await sleep();
		await wake();
		await wake();

		expect(mockPullActivities.startTracking).toHaveBeenCalledTimes(1);
		expect(mockPullActivities.recordIdleTime).toHaveBeenCalledTimes(1);
	});
});
