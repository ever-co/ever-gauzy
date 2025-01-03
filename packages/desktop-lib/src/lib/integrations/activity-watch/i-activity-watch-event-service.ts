import { IDesktopEvent } from '../../interfaces';

export interface IActivityWatchEventService {
	save(event: IDesktopEvent): Promise<void>;

	find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]>;

	clear(): Promise<void>;

	update(activityId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void>;
}

export interface IActivityWatchWindowEventCountService {
	duration(timerId: IDesktopEvent['timerId']): Promise<number>;
}

export interface IActivityWatchEventAfkCountService extends IActivityWatchWindowEventCountService {
	durationAfk(timerId: IDesktopEvent['timerId']): Promise<number>;

	durationNoAfk(timerId: IDesktopEvent['timerId']): Promise<number>;
}

export enum ActivityWatchEventTableList {
	AFK = 'afk_events',
	WINDOW = 'window_events',
	CHROME = 'chrome_events',
	FIREFOX = 'firefox_events',
	EDGE = 'edge_events'
}

export enum ActivityWatchBrowserList {
	CHROME = 'Google Chrome',
	FIREFOX = 'Firefox',
	EDGE = 'Microsoft Edge',
	EDGE_EXE = 'msedge.exe',
	CHROME_EXE = 'chrome.exe',
	FIREFOX_EXE = 'firefox.exe',
	EDGE_LINUX = 'Microsoft-edge',
	CHROME_LINUX = 'Google-chrome'
}
