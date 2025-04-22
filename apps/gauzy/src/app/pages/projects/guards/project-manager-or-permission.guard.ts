import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, switchMap, of, tap, catchError } from 'rxjs';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { ProjectManagerGuard } from './project-manager.guard';

@Injectable({
	providedIn: 'root'
})
export class ProjectManagerOrPermissionGuard {
	constructor(
		private readonly _projectManagerGuard: ProjectManagerGuard,
		private readonly _permissionsGuard: PermissionsGuard,
		private readonly _router: Router
	) {}

	/**
	 * Determines if a route can be activated based on the user's project manager status or required permissions.
	 * - If the user is a manager, access is granted immediately.
	 * - Otherwise, the user must pass the permissions check.
	 * - If neither condition is met or an error occurs, the user is redirected.
	 *
	 * @param route - The route being activated.
	 * @param state - The current router state.
	 * @returns Observable<boolean> - Emits true if access is allowed, otherwise false.
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		const redirectPath = route.data?.['permissions']?.redirectTo || '/pages/dashboard';

		return this._projectManagerGuard.canActivate(route, state).pipe(
			// If the user is a manager, grant access; otherwise, perform permissions check.
			switchMap((isManager) => (isManager ? of(true) : this._permissionsGuard.canActivate(route, state))),
			// If access is denied, redirect to the specified path.
			tap((hasAccess) => !hasAccess && this._router.navigate([redirectPath])),
			// In case of any errors, log the error, redirect, and deny access.
			catchError((error) => {
				console.error('Access check failed:', error);
				this._router.navigate([redirectPath]);
				return of(false);
			})
		);
	}
}
