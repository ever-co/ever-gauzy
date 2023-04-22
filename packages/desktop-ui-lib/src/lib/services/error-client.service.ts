import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class ErrorClientService {
	private _message: string;
	private _stack: string | undefined;

	constructor() { }

	public get message(): any {
		return this._message;
	}

	public set message(error: Error) {
		this._message = error.message ? error.message : error.toString();
	}

	public get stack(): any {
		return this._stack;
	}

	public set stack(error: Error) {
		this._stack = error.stack;
	}
}
