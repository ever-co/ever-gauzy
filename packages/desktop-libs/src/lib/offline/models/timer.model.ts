import { Serializable } from '../../interfaces';
import { TimerTO } from '../dto';

export class Timer implements TimerTO, Serializable<TimerTO> {
	private _id?: number;
	private _day: Date;
	private _duration: number;
	private _employeeId: number;
	private _projectId: string;
	private _taskId: string;
	private _timelogId: string;
	private _timesheetId: string;
	private _timeslotId: string;
	private _stoppedAt: Date;
	private _startedAt: Date;

	constructor(timer: TimerTO) {
		this._id = timer.id;
		this._day = timer.day;
		this._duration = timer.duration;
		this._employeeId = timer.employeeId;
		this._projectId = timer.projectId;
		this._taskId = timer.taskId;
		this._timelogId = timer.timelogId;
		this._timesheetId = timer.timesheetId;
		this._timeslotId = timer.timeslotId;
		this._stoppedAt = timer.stoppedAt;
		this._startedAt = timer.startedAt;
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

	public get id(): number {
		return this._id;
	}
	public set id(value: number) {
		this._id = value;
	}
	public get day(): Date {
		return this._day;
	}
	public set day(value: Date) {
		this._day = value;
	}
	public get duration(): number {
		return this._duration;
	}
	public set duration(value: number) {
		this._duration = value;
	}

	public get employeeId(): number {
		return this._employeeId;
	}
	public set employeeId(value: number) {
		this._employeeId = value;
	}
	public get projectId(): string {
		return this._projectId;
	}
	public set projectId(value: string) {
		this._projectId = value;
	}
	public get taskId(): string {
		return this._taskId;
	}
	public set taskId(value: string) {
		this._taskId = value;
	}
	public get timelogId(): string {
		return this._timelogId;
	}
	public set timelogId(value: string) {
		this._timelogId = value;
	}
	public get timesheetId(): string {
		return this._timesheetId;
	}
	public set timesheetId(value: string) {
		this._timesheetId = value;
	}
	public get timeslotId(): string {
		return this._timeslotId;
	}
	public set timeslotId(value: string) {
		this._timeslotId = value;
	}

	public toObject(): TimerTO {
		return {
			day: this._day,
			duration: this._duration,
			employeeId: this._employeeId,
			projectId: this._projectId,
			taskId: this._taskId,
			timelogId: this._timelogId,
			timesheetId: this._timesheetId,
			timeslotId: this._timeslotId,
			startedAt: this._startedAt,
			stoppedAt: this._stoppedAt,
		};
	}
}
