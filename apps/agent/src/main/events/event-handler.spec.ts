/**
 * The agent restarted tracking whenever the device woke from sleep, even when the person had stopped it. The handler
 * now hands sleep and wake-up events to the tracking worker, which resumes only tracking that the sleep paused (its
 * behaviour is covered by `pull-activities.spec.ts`), and the person's stop stays a real stop rather than a pause.
 */
const mockPullActivities = {
	running: false,
	updateAppUserAuth: jest.fn(),
	pauseForSleep: jest.fn(async () => undefined),
	resumeAfterSleep: jest.fn(async () => undefined),
	startTracking: jest.fn(async () => undefined),
	stopTracking: jest.fn(async () => undefined)
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

describe('EventHandler — sleep and wake-up', () => {
	let handler: EventHandler;

	beforeEach(() => {
		jest.clearAllMocks();
		handler = new EventHandler();
	});

	it('pauses tracking for a device sleep through the worker', async () => {
		await handler.handleEvent({ type: MAIN_EVENT_TYPE.ACTIVITY_PAUSED });

		expect(mockPullActivities.pauseForSleep).toHaveBeenCalledTimes(1);
		expect(mockPullActivities.stopTracking).not.toHaveBeenCalled();
	});

	it('hands the wake-up to the worker instead of starting tracking itself', async () => {
		await handler.handleEvent({ type: MAIN_EVENT_TYPE.ACTIVITY_RESUME });

		expect(mockPullActivities.resumeAfterSleep).toHaveBeenCalledTimes(1);
		expect(mockPullActivities.startTracking).not.toHaveBeenCalled();
	});

	it("treats the person's stop as a real stop, not a pause", async () => {
		await handler.handleEvent({ type: MAIN_EVENT_TYPE.STOP_TIMER });

		expect(mockPullActivities.stopTracking).toHaveBeenCalledWith();
		expect(mockPullActivities.pauseForSleep).not.toHaveBeenCalled();
	});
});
