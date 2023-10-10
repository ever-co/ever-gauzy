import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IIntegrationMap, IIntegrationMapSyncRepository } from '@gauzy/contracts';
import { Observable } from 'rxjs/internal/Observable';
import { API_PREFIX } from '../../constants';

@Injectable({
    providedIn: 'root'
})
export class IntegrationMapService {

    constructor(
        private readonly _http: HttpClient
    ) { }

    /**
     * Synchronize a GitHub repository.
     * @param input The synchronization input data.
     * @returns An Observable of the synchronized IntegrationMap.
     */
    syncGithubRepository(input: IIntegrationMapSyncRepository): Observable<IIntegrationMap> {
        const url = `${API_PREFIX}/integration-map/github/repository-sync`;
        return this._http.post<IIntegrationMap>(url, input);
    }
}
