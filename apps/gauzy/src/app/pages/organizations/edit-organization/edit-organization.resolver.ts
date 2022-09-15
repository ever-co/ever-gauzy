import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, EMPTY, Observable, of as observableOf } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationsService } from '../../../@core/services';

@Injectable({
    providedIn: 'root'
})
export class EditOrganizationResolver implements Resolve<Observable<IOrganization | Observable<never>>> {
    constructor(
        private readonly organizationsService: OrganizationsService,
        private readonly router: Router,
    ) {}

    resolve(
        route: ActivatedRouteSnapshot
    ): Observable<IOrganization | Observable<never>> {
        const organizationId = route.params.id;
        if (!organizationId) {
            return observableOf(EMPTY);
        }
        try {
            return this.organizationsService.getById(organizationId, ['tags']).pipe(
                catchError((error) => {
                    return observableOf(error);
                })
            );
        } catch (error) {
            this.router.navigate(['/pages/organizations']);
        }
    }
}