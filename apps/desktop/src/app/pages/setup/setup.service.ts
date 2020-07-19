import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Injectable({
	providedIn: 'root'
})
export class SetupService {
	constructor(private http: HttpClient) {}

	pingAw(host) {
		return this.http.get(host).pipe().toPromise();
	}
}
