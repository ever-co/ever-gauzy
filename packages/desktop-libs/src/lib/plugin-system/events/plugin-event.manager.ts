import EventEmitter from 'events';

export enum PluginEvent {
	NOTIFY = 'on::plugin::notify'
}

export class PluginEventManager extends EventEmitter {
	private static _instance: PluginEventManager;

	private constructor() {
		super();
		this.removeAllListeners(PluginEvent.NOTIFY);
	}

	public static getInstance(): PluginEventManager {
		if (!this._instance) {
			this._instance = new PluginEventManager();
		}
		return PluginEventManager._instance;
	}

	public notify(message?: string): void {
		this.emit(PluginEvent.NOTIFY, message);
	}

	public listen<T>(listener: (message?: string) => T) {
		this.on(PluginEvent.NOTIFY, listener.bind(this));
	}
}
