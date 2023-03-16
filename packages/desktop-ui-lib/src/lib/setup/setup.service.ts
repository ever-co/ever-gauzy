import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class SetupService {
	constructor(private _http: HttpClient) {}

	public pingAw(host) {
		return firstValueFrom(this._http.get(host));
	}

	public pingServer(values) {
		return firstValueFrom(this._http.get(values.host));
	}
}
