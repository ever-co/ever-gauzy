import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';
import { IIntegrationMap, IIntegrationMapSyncRepository, IIntegrationSyncedRepositoryFindInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
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

    /**
     * Get synced GitHub repositories based on input parameters
     *
     * @param input - Input parameters for the query
     * @returns An Observable of type IIntegrationMap
     */
    getSyncedGithubRepository(input: IIntegrationSyncedRepositoryFindInput): Observable<IIntegrationMap> {
        const url = `${API_PREFIX}/integration-map/github/repository-sync`;
        return this._http.get<IIntegrationMap>(url, {
            params: toParams(input)
        });
    }
}
