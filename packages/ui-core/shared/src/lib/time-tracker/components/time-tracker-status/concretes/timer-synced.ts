import { ITimeLog, TimeLogSourceEnum } from '@gauzy/contracts';
import { ITimerSynced } from '@gauzy/ui-core/core';

export class TimerSynced implements ITimerSynced {
	private _source: TimeLogSourceEnum;
	private _isRunning: boolean;
	private _startedAt: Date;
	private _stoppedAt: Date;
	private _lastLog: ITimeLog;

	constructor(timeLog?: ITimeLog) {
		this._source = timeLog.source as TimeLogSourceEnum;
		this._isRunning = timeLog.isRunning;
		this._startedAt = timeLog.startedAt;
		this._stoppedAt = timeLog.stoppedAt;
		this._lastLog = timeLog;
	}

	public get isExternalSource(): boolean {
		return this.source !== TimeLogSourceEnum.WEB_TIMER;
	}

	public get lastLog(): ITimeLog {
		return this._lastLog;
	}
	public set lastLog(value: ITimeLog) {
		this._lastLog = value;
	}
	public get source(): TimeLogSourceEnum {
		return this._source;
	}
	public set source(value: TimeLogSourceEnum) {
		this._source = value;
	}
	public get running(): boolean {
		return this._isRunning;
	}
	public set running(value: boolean) {
		this._isRunning = value;
	}
	public get startedAt(): Date {
		return this._startedAt;
	}
	public set startedAt(value: Date) {
		this._startedAt = value;
	}
	public get stoppedAt(): Date {
		return this._stoppedAt;
	}
	public set stoppedAt(value: Date) {
		this._stoppedAt = value;
	}
}
