import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PermissionsEnum } from '@gauzy/contracts';
import { AuthService, OrganizationProjectsService, Store } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ProjectManagerGuard implements CanActivate {
	constructor(
		private readonly _store: Store,
		private readonly _router: Router,
		private readonly _projectService: OrganizationProjectsService
	) {}

	/**
	 * Checks if the user is allowed to activate the route based on their manager status for the project.
	 *
	 * This guard ensures that the user either has the required permissions or is a manager of the project
	 * to access the route.
	 *
	 * @param route - The route being navigated to.
	 * @param state - The current state of the router.
	 * @returns An observable that resolves to a boolean indicating whether the user is allowed to activate the route.
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		if (
			!this._store.user?.employee &&
			this._store.hasAllPermissions(PermissionsEnum.ORG_PROJECT_EDIT, PermissionsEnum.ORG_PROJECT_DELETE)
		) {
			return of(true);
		}
		// Get the project ID from the route parameters

		const projectId = route.paramMap.get('id');
		const employeeId = this._store.user?.employee?.id;

		if (!projectId) {
			this._router.navigate(['/pages/dashboard']);
			return of(false);
		}

		// Check if the user has the necessary permissions or is a manager of the project
		return this._projectService.isManagerOfProject(projectId, employeeId).pipe(
			map((isManager) => {
				if (isManager) {
					return true; // Allow access if the user is a manager or has the necessary permissions
				} else {
					this._router.navigate(['/pages/dashboard']); // Redirect to dashboard if not a manager or does not have permission
					return false;
				}
			}),
			catchError(() => {
				this._router.navigate(['/pages/dashboard']);
				return of(false); // In case of an error, redirect to dashboard
			})
		);
	}
}
