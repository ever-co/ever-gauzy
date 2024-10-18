import { Injectable } from '@angular/core';
import * as log from 'electron-log';
import { ElectronService } from './electron.service';

@Injectable({
	providedIn: 'root'
})
export class LoggerService {
	private _log: log.ElectronLog;

	constructor(private readonly _electronService: ElectronService) {
		if (this._electronService.isElectron) {
			// Previously we used that class to on-demand load the electron-log module,
			// but now we load it in the header of this file.
			// Still we want to keep that way to "require" it for now
			this._log = window.require('electron-log');
			console.log = this._log.log;
			Object.assign(console, this._log.functions);
		}
	}

	public get log(): log.ElectronLog {
		return this._log;
	}

	public debug<T>(...message: T[]): void {
		if (this._log) this._log.debug(...message);
	}

	public info<T>(...message: T[]): void {
		if (this._log) this._log.info(...message);
	}

	public error<T>(...message: T[]): void {
		if (this._log) this._log.error(...message);
	}

	public warn(...message: any[]): void {
		if (this._log) this._log.warn(...message);
	}
}
