import {IDataApplication} from "../interfaces";

export class DataApplication implements IDataApplication {
	constructor(title?: string, executable?: string, name?: string, url?: string) {
		this._title = title;
		this._executable = executable;
		this._name = name;
		this._url = url;
	}

	private _title: string;

	public get title(): string {
		return this._title;
	}

	public set title(value: string) {
		this._title = value;
	}

	private _executable: string;

	public get executable(): string {
		return this._executable;
	}

	public set executable(value: string) {
		this._executable = value;
	}

	private _name: string;

	public get name(): string {
		return this._name;
	}

	public set name(value: string) {
		this._name = value;
	}

	private _url: string;

	public get url(): string {
		return this._url;
	}

	public set url(value: string) {
		this._url = value;
	}

	public toObject(): Object {
		return {
			url: this.url,
			title: this.title,
			app: this.name,
			executable: this.executable
		}
	}
}
