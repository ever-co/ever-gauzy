import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ExportAllService {
	constructor(private http: HttpClient) {}

	downloadAllData() {
		return this.http.get(`${API_PREFIX}/download`, {
			responseType: 'blob',
			params: {}
		});
	}

	downloadTemplates() {
		return this.http.get(`${API_PREFIX}/download/template`, {
			responseType: 'blob'
		});
	}

	downloadSpecificData(names: string[]) {
		const data = JSON.stringify({ entities: { names } });
		return this.http.get(`${API_PREFIX}/download/filter`, {
			responseType: 'blob',
			params: { data }
		});
	}
}
