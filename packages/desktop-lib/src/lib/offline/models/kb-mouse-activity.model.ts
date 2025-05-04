import { Serializable } from '../../interfaces';
import { KbMouseActivityTO } from '../dto/kb-mouse-activity.dto';
import { Base } from './base.model';

interface IMouseEvent {
	moveTo: {
		from: {
			x: number;
			y: number;
		},
		to: {
			x: number;
			y: number;
		}
	}
}

export class KbMouseActivity extends Base implements KbMouseActivityTO, Serializable<KbMouseActivityTO> {
	private _timeStart : number;
	private _timeEnd: number | null;
	private _kbPressCount: number;
	private _kbSequence: number[];
	private _mouseMovementsCount: number;
	private _mouseLeftClickCount: number;
	private _mouseRightClickCount: number;
	private _mouseEvents: IMouseEvent[];

	constructor(kbMOuseActivity: KbMouseActivityTO) {
		super(
			kbMOuseActivity.id,
			kbMOuseActivity.tenantId,
			kbMOuseActivity.organizationId
		);
		this._timeStart = kbMOuseActivity.timeStart;
		this._timeEnd = kbMOuseActivity.timeEnd;
		this._kbPressCount = kbMOuseActivity.kbPressCount;
		this._kbSequence = kbMOuseActivity.kbSequence;
		this._mouseMovementsCount = kbMOuseActivity.mouseMovementsCount;
		this._mouseLeftClickCount = kbMOuseActivity.mouseLeftClickCount;
		this._mouseRightClickCount = kbMOuseActivity.mouseRightClickCount;
		this._mouseEvents = kbMOuseActivity.mouseEvents;
	}

	public get timeStart(): number {
		return this._timeStart;
	}
	public set name(value: number) {
		this._timeStart = value;
	}
	public get timeEnd(): number | null {
		return this._timeEnd;
	}
	public set timeEnd(value: number) {
		this._timeEnd = value;
	}
	public get kbPressCount(): number {
		return this._kbPressCount;
	}
	public set kbPressCount(value: number) {
		this._kbPressCount = value;
	}
	public get kbSequence() {
		return this._kbSequence;
	}
	public set kbSequence(value: number[]) {
		this._kbSequence = value;
	}
	public get mouseMovementsCount():number {
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
	public get mouseEvents(): IMouseEvent[] {
		return this._mouseEvents;
	}
	public set mouseEvents(value: IMouseEvent[]) {
		this._mouseEvents = value;
	}

	public toObject(): KbMouseActivityTO {
		return {
			timeStart: this.timeStart,
			timeEnd: this.timeEnd,
			kbPressCount: this.kbPressCount,
			kbSequence: this.kbSequence,
			mouseMovementsCount: this.mouseMovementsCount,
			mouseRightClickCount: this.mouseRightClickCount,
			mouseLeftClickCount: this.mouseLeftClickCount,
			mouseEvents: this.mouseEvents,
			id: this.id,
			organizationId: this.organizationId,
			tenantId: this.tenantId,
			remoteId: this.remoteId
		};
	}
}
