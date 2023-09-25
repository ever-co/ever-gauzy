import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationsService, Store } from './../../@core/services';

@Injectable({
    providedIn: 'root'
})
export class IntergrationResolver implements Resolve<Observable<IIntegrationTenant>> {
    constructor(
        private readonly _integrationsService: IntegrationsService,
        private readonly _store: Store,
    ) { }

    /**
     *
     * @param route
     * @returns
     */
    resolve(route: ActivatedRouteSnapshot): Observable<IIntegrationTenant> {
        const integration = route.data['integration'];
        const { id: organizationId, tenantId } = this._store.selectedOrganization;

        return this._integrationsService.checkRememberState({
            organizationId,
            tenantId,
            name: integration
        }).pipe(
            catchError(error => of(error))
        );
    }
}
