import { Serializable } from '../../interfaces';
import { TimerTO } from '../dto';

export class Timer implements TimerTO, Serializable<TimerTO> {
	private _id?: number;
	private _day: Date;
	private _duration: number;
	private _employeeId: string;
	private _projectId: string;
	private _taskId: string;
	private _timelogId: string;
	private _timesheetId: string;
	private _timeslotId: string;
	private _stoppedAt: Date;
	private _startedAt: Date;
	private _synced: boolean;
	private _isStartedOffline: boolean;
	private _isStoppedOffline: boolean;
	private _version: string;
	private _organizationTeamId: string;
	private _description: string;

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
		this._synced = timer.synced;
		this._isStartedOffline = timer.isStartedOffline;
		this._isStoppedOffline = timer.isStoppedOffline;
		this._version = timer.version;
		this._organizationTeamId = timer.organizationTeamId;
		this._description  = timer.description;
	}

	public get isStoppedOffline(): boolean {
		return this._isStoppedOffline;
	}
	public set isStoppedOffline(value: boolean) {
		this._isStoppedOffline = value;
	}

	public get isStartedOffline(): boolean {
		return this._isStartedOffline;
	}
	public set isStartedOffline(value: boolean) {
		this._isStartedOffline = value;
	}

	public get synced(): boolean {
		return this._synced;
	}
	public set synced(value: boolean) {
		this._synced = value;
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

	public get employeeId(): string {
		return this._employeeId;
	}
	public set employeeId(value: string) {
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

	public get version(): string {
		return this._version;
	}
	public set version(value: string) {
		this._version = value;
	}

	public get organizationTeamId(): string {
		return this._organizationTeamId;
	}

	public set organizationTeamId(value: string) {
		this._organizationTeamId = value;
	}

	public get description(): string {
		return this._description;
	}

	public set description(value: string) {
		this._description = value;
	}

	public toObject(): TimerTO {
		return {
			day: this._day,
			duration: this._duration,
			employeeId: this._employeeId,
			projectId: this._projectId,
			startedAt: this._startedAt,
			stoppedAt: this._stoppedAt,
			synced: this._synced,
			taskId: this._taskId,
			timelogId: this._timelogId,
			timesheetId: this._timesheetId,
			timeslotId: this._timeslotId,
			isStartedOffline: this._isStartedOffline,
			isStoppedOffline: this._isStoppedOffline,
			version: this._version,
			organizationTeamId: this._organizationTeamId,
			description: this._description
		};
	}
}
