import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { EMPTY, Observable, of as observableOf } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import { OrganizationTaskSettingService } from '../../../@core/services/organization-task-setting.service';

@Injectable({
    providedIn: 'root'
})
export class EditOrganizationTaskSettingResolver implements Resolve<Observable<IOrganizationTaskSetting | Observable<never>>> {
    constructor(
        private readonly organizationsTaskSettingService: OrganizationTaskSettingService,
        private readonly router: Router
        ) { }

    resolve(
        route: ActivatedRouteSnapshot
    ): Observable<IOrganizationTaskSetting | Observable<never>>
    {
        const organizationId = route.params.id;
        if (isEmpty(organizationId)) observableOf(EMPTY);
        try
        {
            return this.organizationsTaskSettingService.getByOrganizationId(organizationId).pipe(
                catchError((error) => observableOf(error))
            );
        } catch (error)
        {
            this.router.navigate(['/pages/organizations']);
        }
    }
}
