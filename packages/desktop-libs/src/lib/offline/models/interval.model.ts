import { Serializable } from '../../interfaces';
import { IntervalTO } from '../dto/interval.dto';
import { Base } from './base.model';

export class Interval
	extends Base
	implements IntervalTO, Serializable<IntervalTO>
{
	private _activities: any;
	private _duration: number;
	private _employeeId: string;
	private _keyboard: number;
	private _mouse: number;
	private _organizationContactId: string;
	private _overall: number;
	private _projectId: string;
	private _screenshots: Blob[];
	private _startedAt: Date;
	private _stoppedAt: Date;
	private _synced: boolean;
	private _version: string;

	constructor(interval: IntervalTO) {
		super(
			interval.id,
			interval.organizationId,
			interval.remoteId,
			interval.tenantId
		);
		this._activities = interval.activities;
		this._duration = interval.duration;
		this._employeeId = interval.employeeId;
		this._keyboard = interval.keyboard;
		this._mouse = interval.mouse;
		this._organizationContactId = interval.organizationContactId;
		this._overall = interval.overall;
		this._projectId = interval.projectId;
		this._screenshots = interval.screenshots;
		this._startedAt = interval.startedAt;
		this._stoppedAt = interval.stoppedAt;
		this._synced = interval.synced;
		this._version = interval.version;
	}

	public get activities(): any {
		return this._activities;
	}
	public set activities(value: any) {
		this._activities = value;
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
	public get keyboard(): number {
		return this._keyboard;
	}
	public set keyboard(value: number) {
		this._keyboard = value;
	}
	public get mouse(): number {
		return this._mouse;
	}
	public set mouse(value: number) {
		this._mouse = value;
	}
	public get organizationContactId(): string {
		return this._organizationContactId;
	}
	public set organizationContactId(value: string) {
		this._organizationContactId = value;
	}
	public get overall(): number {
		return this._overall;
	}
	public set overall(value: number) {
		this._overall = value;
	}
	public get projectId(): string {
		return this._projectId;
	}
	public set projectId(value: string) {
		this._projectId = value;
	}
	public get screenshots(): Blob[] {
		return this._screenshots;
	}
	public set screenshots(value: Blob[]) {
		this._screenshots = value;
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
	public get synced(): boolean {
		return this._synced;
	}
	public set synced(value: boolean) {
		this._synced = value;
	}
	public get version(): string {
		return this._version;
	}
	public set version(value: string) {
		this._version = value;
	}
	public toObject(): IntervalTO {
		return {
			activities: this._activities,
			screenshots: this._screenshots,
			startedAt: this._startedAt,
			stoppedAt: this._stoppedAt,
			synced: this._synced,
			organizationContactId: this._organizationContactId,
			overall: this._overall,
			mouse: this._mouse,
			keyboard: this._keyboard,
			duration: this._duration,
			employeeId: this._employeeId,
			projectId: this._projectId,
			version: this._version,
			...super.toObject()
		};
	}
}
