import { IDateRange } from './timesheet.model';

export interface IActivityWatchBaseEvent {
	id: number;
	timestamp: string;
	duration: number;
}

export interface IActivityWatchWindowEvent extends IActivityWatchBaseEvent {
	data: {
		url: string;
		title: string;
		app: string;
	};
}

export interface IActivityWatchBucketWatcherList {
	[key: string]: IActivityWatchBucket;
}

export interface IActivityWatchBucket {
	id: string;
	created: string;
	name: string | null;
	type: string;
	client: string;
	hostname: string;
	last_updated: string;
}

export enum ActivityWatchAfkEventStatus {
	NO_AFK = 'not-afk',
	AFK = 'afk'
}

export interface IActivityWatchAfkEvent extends IActivityWatchBaseEvent {
	data: {
		status: ActivityWatchAfkEventStatus;
	};
}

export interface IActivityWatchWebEvent extends IActivityWatchBaseEvent {
	data: {
		url: string;
		title: string;
		audible: boolean;
		incognito: boolean;
		tabCount: number;
	};
}

export interface IActivityWatchCollectEventData extends IDateRange {
	timerId: number;
}

export type IActivityWatchEvent = IActivityWatchWebEvent | IActivityWatchAfkEvent | IActivityWatchWindowEvent;

export type IActivityWatchEventCollection = IActivityWatchEvent[];

export enum ActivityWatchEventType {
	APP = 'APP',
	URL = 'URL',
	AFK = 'AFK'
}

export interface IActivityWatchEventResult {
	timerId: number;
	event: IActivityWatchEventCollection;
	type: ActivityWatchEventType;
}

export enum ActivityWatchCollectEvent {
	WINDOW = 'collect_data',
	AFK = 'collect_afk',
	CHROME = 'collect_chrome_activities',
	FIREFOX = 'collect_firefox_activities',
	EDGE = 'collect_edge_activities'
}
