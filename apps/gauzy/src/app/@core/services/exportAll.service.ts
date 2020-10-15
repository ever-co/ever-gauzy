import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
	providedIn: 'root'
})
export class ExportAllService {
	constructor(private http: HttpClient) {}

	downloadAllData(findInput) {
		const data = JSON.stringify({ findInput });
		return this.http.get(`/api/download`, {
			responseType: 'blob',
			params: { data }
		});
	}

	downloadTemplates() {
		return this.http.get(`/api/download/template`, {
			responseType: 'blob'
		});
	}

	downloadSpecificData(names: string[], findInput) {
		const data = JSON.stringify({ entities: { names }, findInput });
		return this.http.get(`/api/download/filter`, {
			responseType: 'blob',
			params: { data }
		});
	}
}
