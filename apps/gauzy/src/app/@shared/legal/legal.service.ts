import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  	providedIn: 'root'
})
export class LegalService {
	constructor(
		private readonly http: HttpClient
	) {}

	getJsonFromUrl(url: string) {
		return this.http.get<any>(url);
	}
}
