import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LegalService {
	constructor(
		private readonly http: HttpClient
	) { }
	/**
	 * Load content from iubenda
	 * 
	 * @param url https://www.iubenda.com/api/privacy-policy/18120170
	 */
	getContentFromFromUrl(url: string) {
		return this.http
			.get(url)
			.pipe()
			.toPromise();
	}
}
