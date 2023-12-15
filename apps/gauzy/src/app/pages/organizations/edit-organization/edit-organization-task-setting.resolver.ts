import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { EMPTY, Observable, of as observableOf } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import { OrganizationTaskSettingService, Store } from '../../../@core/services';

@Injectable({
    providedIn: 'root'
})
export class EditOrganizationTaskSettingResolver implements Resolve<Observable<IOrganizationTaskSetting | Observable<never>>> {

    constructor(
        private readonly _router: Router,
        private readonly _store: Store,
        private readonly _organizationsTaskSettingService: OrganizationTaskSettingService,
    ) { }

    resolve(route: ActivatedRouteSnapshot): Observable<IOrganizationTaskSetting | Observable<never>> {
        const organizationId = route.params.id;

        if (isEmpty(organizationId)) {
            return observableOf(EMPTY);
        }

        const organization = this._store.selectedOrganization;
        const { tenantId } = organization;

        try {
            return this._organizationsTaskSettingService.getByOrganization({ organizationId, tenantId }).pipe(
                catchError(() => {
                    this._router.navigate(['/pages/organizations']);
                    return observableOf(EMPTY);
                })
            );
        } catch (error) {
            this._router.navigate(['/pages/organizations']);
        }
    }
}
