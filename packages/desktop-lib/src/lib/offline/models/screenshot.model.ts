
import { Serializable } from '../../interfaces';
import { ScreenshotTO } from '../dto/screenshot.dto';

export class Screenshot implements ScreenshotTO, Serializable<ScreenshotTO> {
	private _timeSlotId?: string;
	private _activityId: number;
	private _imagePath: string;
	private _synced: boolean;
	private _id: number;
	private _recordedAt: Date;
	private _message?: string;
	private _retries?: number;
	private _lastAttemptAt?: Date;

	constructor(screenshot: ScreenshotTO) {
		this._id = screenshot.id;
		this._timeSlotId = screenshot.timeslotId;
		this._activityId = screenshot.activityId;
		this._imagePath = screenshot.imagePath;
		this._synced = screenshot.synced;
		this._recordedAt = screenshot.recordedAt;
		this._message = screenshot.message;
		this._retries = screenshot.retries;
		this._lastAttemptAt = screenshot.lastAttemptAt;
	}

	public set id(value: number) {
		this._id = value;
	}
	public get id(): number {
		return this._id;
	}
	public set timeslotId(value: string) {
		this._timeSlotId = value;
	}
	public get timeslotId(): string {
		return this._timeSlotId;
	}
	public set activityId(value: number) {
		this._activityId = value;
	}
	public get activityId(): number {
		return this._activityId;
	}
	public set imagePath(value: string) {
		this._imagePath = value;
	}
	public get imagePath(): string {
		return this._imagePath;
	}
	public set synced(value: boolean) {
		this._synced = value;
	}
	public get synced(): boolean {
		return this._synced;
	}
	public set recordedAt(value: Date) {
		this._recordedAt = value;
	}
	public get recordedAt(): Date {
		return this._recordedAt;
	}
	public set message(value: string) {
		this._message = value;
	}
	public get message(): string {
		return this._message;
	}
	public set retries(value: number) {
		this._retries = value;
	}
	public get retries(): number {
		return this._retries;
	}
	public set lastAttemptAt(value: Date) {
		this._lastAttemptAt = value;
	}
	public get lastAttemptAt(): Date {
		return this._lastAttemptAt;
	}

	public toObject(): ScreenshotTO {
		return {
			id: this.id,
			timeslotId: this.timeslotId,
			activityId: this.activityId,
			imagePath: this.imagePath,
			synced: this.synced,
			recordedAt: this.recordedAt,
			message: this.message,
			retries: this.retries,
			lastAttemptAt: this.lastAttemptAt
		};
	}
}
