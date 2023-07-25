import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { debounceTime, EMPTY, Observable, of as observableOf } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';
import { OrganizationTaskSettingService } from '../../../@core/services/organization-task-setting.service';

@Injectable({
    providedIn: 'root'
})
export class EditOrganizationTaskSettingResolver implements Resolve<Observable<IOrganizationTaskSetting | Observable<never>>> {
    constructor(
        private readonly organizationsTaskSettingService: OrganizationTaskSettingService,
        private readonly router: Router,
        private readonly store: Store,
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
                debounceTime(200),
                tap((organizationTaskSetting: IOrganizationTaskSetting) =>
                {
                    this.store.selectedOrganizationTaskSetting = organizationTaskSetting;
                }),
                catchError((error) => observableOf(error))
            );
        } catch (error)
        {
            this.router.navigate(['/pages/organizations']);
        }
    }
}
