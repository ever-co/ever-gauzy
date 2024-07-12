import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';
import { IIntegrationAICreateInput, IIntegrationTenant } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class GauzyAIService extends CrudService<IIntegrationTenant> {
	static readonly API_URL = `${API_PREFIX}/integration/ai`;

	constructor(readonly _http: HttpClient) {
		super(_http, GauzyAIService.API_URL);
	}

	/**
	 * Create a new integration AI.
	 *
	 * @param input - Data for creating the integration AI, of type IIntegrationAICreateInput.
	 * @returns An Observable of type IIntegrationTenant representing the created integration AI.
	 */
	create(input: IIntegrationAICreateInput): Observable<IIntegrationTenant> {
		return this._http.post<IIntegrationTenant>(`${GauzyAIService.API_URL}`, input);
	}
}
