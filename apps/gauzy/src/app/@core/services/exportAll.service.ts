import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
	providedIn: 'root'
})
export class ExportAllService {
	constructor(private http: HttpClient) {}

	downloadAllData() {
		return this.http.get(`/api/download`, { responseType: 'blob' });
	}

	downloadTemplates() {
		return this.http.get(`/api/download/template`, {
			responseType: 'blob'
		});
	}

	downloadSpecificData(names: string[]) {
		const data = JSON.stringify({ names });
		return this.http.get(`/api/download/filter`, {
			responseType: 'blob',
			params: { data }
		});
	}
}
