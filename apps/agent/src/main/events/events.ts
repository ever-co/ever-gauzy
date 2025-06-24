import { EventEmitter } from 'events';
import { TEventArgs } from './event-types';

export default class MainEvent {
	private static instance: MainEvent;
	private events: EventEmitter;
	constructor() {
		this.events = new EventEmitter();
	}

	static getInstance(): MainEvent {
		if (!MainEvent.instance) {
			MainEvent.instance = new MainEvent();
		}
		return MainEvent.instance;
	}

	on(eventName: string, callBack: (args: TEventArgs) => void) {
		this.events.on(eventName, callBack);
	}

	emit(eventName: string, args: TEventArgs) {
		this.events.emit(eventName, args);
	}
}
