import * as EventEmitter from 'events';

enum ErrorHandlerEvent {
	REPORT = 'send_report_error',
	SHOW = 'show_dialog_error',
}

export class ErrorEventManager extends EventEmitter {
	private static _instance: ErrorEventManager;

	private constructor() {
		super();
		this.removeAllListeners(ErrorHandlerEvent.REPORT);
	}

	public static get instance(): ErrorEventManager {
		if (!this._instance) {
			this._instance = new ErrorEventManager();
		}
		return ErrorEventManager._instance;
	}

	public sendReport(message?: string): void {
		this.emit(ErrorHandlerEvent.REPORT, message);
	}

	public onSendReport<T>(listener: (message?: string) => T) {
		this.on(ErrorHandlerEvent.REPORT, listener.bind(this));
	}

	public showError(message?: string): void {
		this.emit(ErrorHandlerEvent.SHOW, message);
	}

	public onShowError<T>(listener: (message?: string) => T) {
		this.on(ErrorHandlerEvent.REPORT, listener.bind(this));
	}
}
