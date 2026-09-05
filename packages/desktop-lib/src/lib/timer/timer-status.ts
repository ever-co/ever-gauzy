import { TimerTO } from "../offline";
import * as moment from "moment";
export class TimerStatus {
	private static instance: TimerStatus;
	private _isRunning: boolean;
	private _isPaused: boolean;
	private _lastTimer: TimerTO | null;
	private _timeStart: Date | null;
	private _timeSlotStart: Date  | null | moment.Moment;
	private _timeRecordSecond: number;
	private _timeRecordMinute: number;
	private _timeRecordHours: number;

	constructor() {}

	static getInstance() {
		if (!TimerStatus.instance) {
			TimerStatus.instance = new TimerStatus();
		}
		return TimerStatus.instance;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	set isRunning(value: boolean) {
		this._isRunning = value;
	}

	get lastTimer(): TimerTO | null {
		return this._lastTimer;
	}

	set lastTimer(value: TimerTO | null) {
		this._lastTimer = value;
	}

	get timeStart(): Date | null {
		return this._timeStart;
	}

	set timeStart(value: Date | null) {
		this._timeStart = value;
	}

	get timeSlotStart(): Date | moment.Moment | null {
		return this._timeSlotStart;
	}

	set timeSlotStart(value: Date | moment.Moment | null) {
		this._timeSlotStart = value;
	}

	get timeRecordSecond(): number {
		return this._timeRecordSecond;
	}

	set timeRecordSecond(value: number) {
		this._timeRecordSecond = value;
	}

	get timeRecordMinute(): number {
		return this._timeRecordMinute;
	}

	set timeRecordMinute(value: number) {
		this._timeRecordMinute = value;
	}

	get timeRecordHours(): number {
		return this._timeRecordHours;
	}

	set timeRecordHours(value: number) {
		this._timeRecordHours = value;
	}
}
