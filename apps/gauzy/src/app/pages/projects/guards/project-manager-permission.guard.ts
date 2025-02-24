import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, switchMap, of, tap, catchError } from 'rxjs';
import { ProjectManagerGuard } from './project-manager.guard';
import { PermissionsGuard } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ProjectManagerPermissionGuard {
	constructor(
		private readonly _projectManagerGuard: ProjectManagerGuard,
		private readonly _permissionsGuard: PermissionsGuard,
		private readonly _router: Router
	) {}

	/**
	 * First checks if the user is a manager of the project.
	 * If the user is a manager, allow access without checking permissions.
	 * If the user is not a manager, check if the user has the required permissions.
	 *
	 * @param route - The route being activated.
	 * @param state - The state of the router.
	 * @returns Observable<boolean> - True if either the manager check passes or permissions check passes, false otherwise.
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		const redirectPath = route.data?.['permissions']?.redirectTo || '/pages/dashboard';

		return this._projectManagerGuard.canActivate(route, state).pipe(
			switchMap((isManager) => (isManager ? of(true) : this._permissionsGuard.canActivate(route, state))),
			tap((hasAccess) => {
				if (!hasAccess) {
					this._router.navigate([redirectPath]);
				}
			}),
			catchError((error) => {
				console.error('Access check failed:', error);
				this._router.navigate([redirectPath]);
				return of(false);
			})
		);
	}
}
