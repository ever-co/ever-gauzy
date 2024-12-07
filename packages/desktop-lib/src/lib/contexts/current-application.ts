import {DataApplication} from "./data-application";
import {ICurrentApplication, IDataApplication} from "../interfaces";


export class CurrentApplication implements ICurrentApplication {

	constructor(timestamp?: string, duration?: number, data?: DataApplication) {
		this._duration = duration;
		this._timestamp = timestamp;
		this._data = data;
	}

	private _duration: number;

	public get duration(): number {
		return this._duration;
	}

	public set duration(value: number) {
		this._duration = value;
	}

	private _timestamp: string;

	public get timestamp(): string {
		return this._timestamp;
	}

	public set timestamp(value: string) {
		this._timestamp = value;
	}

	private _data: IDataApplication;

	public get data(): IDataApplication {
		return this._data;
	}

	public set data(value: IDataApplication) {
		this._data = value;
	}

	public toObject(): Object {
		return {
			duration: this.duration,
			timestamp: this.timestamp,
			data: this.data.toObject()
		};
	}
}
