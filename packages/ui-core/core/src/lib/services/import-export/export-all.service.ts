import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ExportAllService {
	constructor(private readonly http: HttpClient) {}

	downloadAllData() {
		return this.http.get(`${API_PREFIX}/download`, {
			responseType: 'blob'
		});
	}

	downloadExportTemplates() {
		return this.http.get(`${API_PREFIX}/export/template`, {
			responseType: 'blob'
		});
	}

	downloadSpecificTable(names: string[]) {
		const data = JSON.stringify({ entities: { names } });

		if (!names) return;

		return this.http.get(`${API_PREFIX}/export/filter`, {
			responseType: 'blob',
			params: { data }
		});
	}
}
