import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationsService, Store } from './../../@core/services';

@Injectable({
    providedIn: 'root'
})
export class IntegrationResolver implements Resolve<Observable<IIntegrationTenant | boolean>> {
    /**
     * Constructs the IntegrationResolver.
     * @param _integrationsService The integration tenant service used to fetch integration details.
     * @param router The router service for navigation.
     */
    constructor(
        private readonly _router: Router,
        private readonly _store: Store,
        private readonly _integrationsService: IntegrationsService,
    ) { }

    /**
    * Resolves project details before activating a specific route.
    * @param route The activated route snapshot.
    * @returns An observable containing integration details or an empty observable.
    */
    resolve(route: ActivatedRouteSnapshot): Observable<IIntegrationTenant | boolean> {
        try {
            const integration = route.data['integration'];
            const { id: organizationId, tenantId } = this._store.selectedOrganization;

            return this._integrationsService.getIntegrationByOptions({
                organizationId,
                tenantId,
                name: integration
            }).pipe(
                catchError(() => {
                    this._router.navigate(['/pages/integrations/new']);
                    return EMPTY;
                })
            );
        } catch (error) {
            this._router.navigate(['/pages/integrations/new']);
        }
    }
}
