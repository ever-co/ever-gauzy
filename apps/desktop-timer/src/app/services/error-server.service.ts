import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class ErrorServerService {
	private _message: string;

	constructor() { }

	public get message(): any {
		return this._message;
	}

	public set message(error: HttpErrorResponse) {
		this._message = error.message;
	}
}
