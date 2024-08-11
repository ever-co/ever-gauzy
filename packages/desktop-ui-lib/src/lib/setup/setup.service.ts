import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class SetupService {
	defaultTimeout = 1000 * 10;
	constructor(private _http: HttpClient) { }

	public pingAw(host) {
		return firstValueFrom(this._http.get(host, { responseType: 'text' }));
	}

	public pingServer(values) {

		return firstValueFrom(this._http.get(values.host + '/api').pipe(
			timeout(this.defaultTimeout)
		));
	}
}
