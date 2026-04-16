import { SyncLogTO } from "../dto";
import { Serializable } from "../../interfaces";

export class SyncDataLog implements SyncLogTO, Serializable<SyncLogTO> {
	private _id: number;
	private _payload: string;
	private _status: string;
	private _key: string;
	private _createdAt: Date;
	private _errorMessage: string;
	private _response: string;

	constructor(syncDataLog: SyncLogTO) {
		this._id = syncDataLog.id;
		this._payload = syncDataLog.payload;
		this._status = syncDataLog.status;
		this._key = syncDataLog.key;
		this._createdAt = syncDataLog.createdAt;
		this._errorMessage = syncDataLog.errorMessage;
		this._response = syncDataLog.response;
	}

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		this._id = value;
	}

	public get payload(): string {
		return this._payload;
	}

	public set payload(value: string) {
		this._payload = value;
	}

	public get status(): string {
		return this._status;
	}

	public set status(value: string) {
		this._status = value;
	}

	public get key(): string {
		return this._key;
	}

	public set key(value: string) {
		this._key = value;
	}

	public get createdAt(): Date {
		return this._createdAt;
	}

	public set createdAt(value: Date) {
		this._createdAt = value;
	}

	public get errorMessage(): string {
		return this._errorMessage;
	}

	public set errorMessage(value: string) {
		this._errorMessage = value;
	}

	public get response(): string {
		return this._response;
	}

	public set response(value: string) {
		this._response = value;
	}

	toObject(): SyncLogTO {
		return {
			id: this.id,
			payload: this.payload,
			status: this.status,
			key: this.key,
			createdAt: this.createdAt,
			errorMessage: this.errorMessage,
			response: this.response,
		}
	}
}
