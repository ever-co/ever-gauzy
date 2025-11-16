import { Serializable } from '../../interfaces';
import { KbMouseActivityTO, TMouseEvents, TActiveWindows } from '../dto/kb-mouse-activity.dto';
import { Base } from './base.model';

export class KbMouseActivity extends Base implements KbMouseActivityTO, Serializable<KbMouseActivityTO> {
	private _timeStart: Date;
	private _timeEnd: Date | null;
	private _kbPressCount: number;
	private _kbSequence: number[] | string;
	private _mouseMovementsCount: number;
	private _mouseLeftClickCount: number;
	private _mouseRightClickCount: number;
	private _mouseEvents: TMouseEvents[] | string;
	private _screenshots: string[] | string;
	private _afkDuration: number = 0;
	private _activeWindows: TActiveWindows[] | string;
	private _syncedActivity: boolean;
	private _timerId: number;
	private _timeSlotId: string;

	constructor(kbMouseActivity: KbMouseActivityTO) {
		super(kbMouseActivity.id, kbMouseActivity.tenantId, kbMouseActivity.organizationId);
		this._timeStart = kbMouseActivity.timeStart;
		this._timeEnd = kbMouseActivity.timeEnd;
		this._kbPressCount = kbMouseActivity.kbPressCount;
		this._kbSequence = kbMouseActivity.kbSequence;
		this._mouseMovementsCount = kbMouseActivity.mouseMovementsCount;
		this._mouseLeftClickCount = kbMouseActivity.mouseLeftClickCount;
		this._mouseRightClickCount = kbMouseActivity.mouseRightClickCount;
		this._mouseEvents = kbMouseActivity.mouseEvents;
		this._screenshots = kbMouseActivity.screenshots;
		this._afkDuration = kbMouseActivity.afkDuration;
		this._activeWindows = kbMouseActivity.activeWindows;
		this._syncedActivity = kbMouseActivity.syncedActivity;
		this._timerId = kbMouseActivity.timerId;
		this._timeSlotId = kbMouseActivity.timeSlotId;
	}

	public get timeStart(): Date {
		return this._timeStart;
	}
	public set timeStart(value: Date) {
		this._timeStart = value;
	}
	public get timeEnd(): Date | null {
		return this._timeEnd;
	}
	public set timeEnd(value: Date) {
		this._timeEnd = value;
	}
	public get kbPressCount(): number {
		return this._kbPressCount;
	}
	public set kbPressCount(value: number) {
		this._kbPressCount = value;
	}
	public get kbSequence(): number[] | string {
		return this._kbSequence;
	}
	public set kbSequence(value: number[]) {
		this._kbSequence = value;
	}
	public get mouseMovementsCount(): number {
		return this._mouseMovementsCount;
	}
	public set mouseMovementsCount(value: number) {
		this._mouseMovementsCount = value;
	}
	public get mouseLeftClickCount(): number {
		return this._mouseLeftClickCount;
	}
	public set mouseLeftClickCount(value: number) {
		this._mouseLeftClickCount = value;
	}
	public get mouseRightClickCount(): number {
		return this._mouseRightClickCount;
	}
	public set mouseRightClickCount(value: number) {
		this._mouseRightClickCount = value;
	}
	public get mouseEvents(): TMouseEvents[] | string {
		return this._mouseEvents;
	}
	public set mouseEvents(value: TMouseEvents[] | string) {
		this._mouseEvents = value;
	}
	public get screenshots(): string[] | string {
		return this._screenshots;
	}
	public set screenshots(value: string[]) {
		this._screenshots = value;
	}
	public set afkDuration(value: number) {
		this._afkDuration = value;
	}
	public get afkDuration(): number {
		return this._afkDuration;
	}
	public set activeWindows(value: TActiveWindows[] | string) {
		this._activeWindows = value;
	}
	public get activeWindows(): TActiveWindows[] | string {
		return this._activeWindows;
	}
	public set syncedActivity(value: boolean) {
		this._syncedActivity = value;
	}
	public get syncedActivity(): boolean {
		return this._syncedActivity;
	}
	public set timerId(value: number) {
		this._timerId = value;
	}
	public get timerId(): number {
		return this._timerId;
	}
	public set timeSlotId(value: string) {
		this._timeSlotId = value;
	}
	public get timeSlotId(): string {
		return this._timeSlotId;
	}

	public toObject(): KbMouseActivityTO {
		return {
			timeStart: this.timeStart,
			timeEnd: this.timeEnd,
			kbPressCount: this.kbPressCount,
			kbSequence: Array.isArray(this.kbSequence) ? this.kbSequence : [],
			mouseMovementsCount: this.mouseMovementsCount,
			mouseRightClickCount: this.mouseRightClickCount,
			mouseLeftClickCount: this.mouseLeftClickCount,
			mouseEvents: Array.isArray(this.mouseEvents) ? this.mouseEvents : [],
			id: this.id,
			organizationId: this.organizationId,
			tenantId: this.tenantId,
			remoteId: this.remoteId,
			screenshots: Array.isArray(this.screenshots) ? this.screenshots : [],
			afkDuration: this.afkDuration,
			activeWindows: Array.isArray(this.activeWindows) ? this.activeWindows : [],
			syncedActivity: this.syncedActivity,
			timerId: this.timerId,
			timeSlotId: this.timeSlotId
		};
	}
}
