import { IErrorReportRepository } from './i-error-report-repository';

export class ErrorReportRepository implements IErrorReportRepository {
	private _owner: string;
	private _name: string;
	private _isOpenSource?: boolean;

	constructor(owner: string, name: string, isOpenSource?: boolean) {
		this._owner = owner;
		this._name = name;
		this._isOpenSource = isOpenSource || true;
	}

	public get isOpenSource(): boolean {
		return this._isOpenSource;
	}
	public set isOpenSource(value: boolean) {
		this._isOpenSource = value;
	}
	public get owner(): string {
		return this._owner;
	}
	public set owner(value: string) {
		this._owner = value;
	}
	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}
}
