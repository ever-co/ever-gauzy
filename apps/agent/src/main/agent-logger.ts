import AppWindow from "./window-manager";
import * as moment from 'moment';
import * as path from 'node:path';

export class AgentLogger {
	static instance: AgentLogger;
	private appWindow: AppWindow;
	constructor() {
		this.appWindow = AppWindow.getInstance(path.join(__dirname, '..'));
		this.appWindow.initLogWindow()
	}

	static getInstance(): AgentLogger {
		if (!AgentLogger.instance) {
			AgentLogger.instance = new AgentLogger();
		}
		return AgentLogger.instance;
	}

	formatMessage(message: string, type: string) {
		return `${moment().format('YYYY-MM-DD HH:mm:ss')} ${type}: ${message}`;
	}

	showMessage(message: string) {
		this.appWindow.logWindow?.webContents?.send('log_state', {
			msg: message
		});
	}

	info(message: string) {
		const logMsg = this.formatMessage(message, 'Info');
		this.showMessage(logMsg);
		console.log(logMsg);
	}

	warn(message: string) {
		const logMsg = this.formatMessage(message, 'Warn');
		console.warn(logMsg);
		this.showMessage(logMsg);
	}

	error(message: string) {
		const logMsg = this.formatMessage(message, 'Error');
		console.error(logMsg);
		this.showMessage(logMsg);
	}
}
