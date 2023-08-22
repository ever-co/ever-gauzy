import EventEmitter from 'events';

enum TranslateEvent {
	LANGUAGE_CHANGE = 'language_change',
}

export class TranslateEventManager extends EventEmitter {
	private static _instance: TranslateEventManager;

	private constructor() {
		super();
		this.removeAllListeners(TranslateEvent.LANGUAGE_CHANGE);
	}

	private static get instance(): TranslateEventManager {
		if (!this._instance) {
			this._instance = new TranslateEventManager();
		}
		return TranslateEventManager._instance;
	}

	public static trigger(language?: string): void {
		this.instance.emit(TranslateEvent.LANGUAGE_CHANGE, language);
	}

	public static listen<T>(listener: (language?: string) => T) {
		this.instance.on(TranslateEvent.LANGUAGE_CHANGE, listener.bind(this));
	}
}
