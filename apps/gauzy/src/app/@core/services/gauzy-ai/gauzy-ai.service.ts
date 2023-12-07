import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';
import { IIntegrationAICreateInput, IIntegrationTenant } from '@gauzy/contracts';
import { API_PREFIX } from '../../constants';

@Injectable({
	providedIn: 'root',
})
export class GauzyAIService {

	constructor(
		private readonly _http: HttpClient
	) { }

	/**
	 *
	 * @param input
	 * @returns
	 */
	create(input: IIntegrationAICreateInput): Observable<IIntegrationTenant> {
		return this._http.post<IIntegrationTenant>(`${API_PREFIX}/integration/gauzy-ai`, input);
	}
}
