import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ExportAllService {

	constructor(
		private readonly http: HttpClient
	) { }

	downloadExportTemplates() {
		return this.http.get(`${API_PREFIX}/export/template`, {
			responseType: 'blob'
		});
	}

	downloadSpecificTable(names: string[]) {
		const data = JSON.stringify({ entities: { names } });
		return this.http.get(`${API_PREFIX}/export/filter`, {
			responseType: 'blob',
			params: { data }
		});
	}
}
