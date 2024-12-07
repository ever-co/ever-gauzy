import { IError } from './i-error';

export abstract class BaseError extends Error implements IError {
	private _id: string;
	private _name: string;
	private _code: string;
	private _message: string;

	public get id(): string {
		return this._id;
	}
	public set id(value: string) {
		this._id = value;
	}

	public get code(): string {
		return this._code;
	}
	public set code(value: string) {
		this._code = value;
	}

	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}

	public get message(): string {
		return this._message;
	}
	public set message(value: string) {
		this._message = value;
	}
}
