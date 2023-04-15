import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
	providedIn: 'root',
})
export class LoggerService {
	private _log: any;

	constructor(private readonly _electronService: ElectronService) {
		if (this._electronService.isElectron) {
			this._log = window.require('electron-log');
			console.log = this._log.log;
			Object.assign(console, this._log.functions);
		}
	}

	public get log(): any {
		return this._log;
	}
}
