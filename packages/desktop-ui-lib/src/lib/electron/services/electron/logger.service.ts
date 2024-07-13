import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import log from 'electron-log';

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
}
