import { IntervalTO } from '../dto/interval.dto';
import { Base } from './base.model';

export class Interval extends Base implements IntervalTO {
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

	constructor(
		activities: any,
		duration: number,
		employeeId: string,
		keyboard: number,
		mouse: number,
		organizationContactId: string,
		overall: number,
		projectId: string,
		screenshots: Blob[],
		startedAt: Date,
		stoppedAt: Date,
		synced: boolean,
		id?: number,
		organizationId?: string,
		remoteId?: string,
		tenantId?: string
	) {
		super(id, organizationId, remoteId, tenantId);
		this._activities = activities;
		this._duration = duration;
		this._employeeId = employeeId;
		this._keyboard = keyboard;
		this._mouse = mouse;
		this._organizationContactId = organizationContactId;
		this._overall = overall;
		this._projectId = projectId;
		this._screenshots = screenshots;
		this._startedAt = startedAt;
		this._stoppedAt = stoppedAt;
		this._synced = synced;
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
}
