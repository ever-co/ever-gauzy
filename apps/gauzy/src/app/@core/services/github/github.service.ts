import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IGithubAppInstallInput, IIntegrationTenant } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class GithubService {

    constructor(
        private readonly _http: HttpClient
    ) { }

    /**
     *
     * @param input
     * @returns
     */
    async addInstallationApp(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
        return firstValueFrom(
            this._http.post<IIntegrationTenant>(`${API_PREFIX}/integration/github/install`, input)
        );
    }
}
