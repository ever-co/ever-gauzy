import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve } from "@angular/router";
import { map } from "rxjs/operators";
import { Observable } from "rxjs/internal/Observable";
import { IOrganizationProject } from "@gauzy/contracts";
import { OrganizationProjectsService, Store } from "../../../@core/services";

/**
 * A resolver service for retrieving synchronized organization projects.
 */
@Injectable({
    providedIn: 'root'
})
export class SyncedProjectsResolver implements Resolve<Observable<IOrganizationProject[] | boolean>> {

    /**
     * Constructs the `SyncedProjectsResolver`.
     * @param store - An instance of the `Store` service.
     * @param organizationProjectsService - An instance of the `OrganizationProjectsService`.
     */
    constructor(
        private readonly _store: Store,
        private readonly _organizationProjectsService: OrganizationProjectsService
    ) { }

    /**
     * Resolves synchronized organization projects.
     * @param route - The activated route snapshot.
     * @returns An observable of type `IOrganizationProject[]` or `boolean`.
     */
    resolve(route: ActivatedRouteSnapshot): Observable<IOrganizationProject[] | boolean> {
        const { id: organizationId, tenantId } = this._store.selectedOrganization;
        return this._organizationProjectsService.findSyncedProjects({ organizationId, tenantId }, ['repository']).pipe(
            map(({ items }) => items)
        );
    }
}
