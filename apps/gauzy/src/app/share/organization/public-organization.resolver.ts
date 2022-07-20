import { Injectable } from '@angular/core';
import {
	Resolve,
	RouterStateSnapshot,
	ActivatedRouteSnapshot,
	Router
} from '@angular/router';
import { IOrganization } from '@gauzy/contracts';
import { EMPTY, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorHandlingService, OrganizationsService } from '../../@core/services';

@Injectable({
	providedIn: 'root'
})
export class PublicOrganizationResolver implements Resolve<any> {
	constructor(
		private readonly organizationsService: OrganizationsService,
		private readonly router: Router,
		private readonly errorHandlingService: ErrorHandlingService
	) {}

	resolve(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): Observable<IOrganization> {
		try {
            const profile_link = route.params.link;
			return this.organizationsService.getByProfileLink(profile_link, [
				'skills',
				'awards',
				'languages',
				'languages.language'
			]).pipe(
				catchError((error) => {
					this.errorHandlingService.handleError(error);
					this.router.navigateByUrl('/');
					return EMPTY;
				})
			);
        } catch (error) {
            this.router.navigateByUrl('/');
        }
	}
}
