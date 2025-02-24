import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
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
		return new Observable<boolean>((observer) => {
			// First, check if the user is a manager of the project using ProjectManagerGuard
			this._projectManagerGuard.canActivate(route, state).subscribe((isManager) => {
				if (isManager) {
					// If the user is a manager, allow access without checking permissions
					observer.next(true);
					observer.complete();
				} else {
					// If the user is not a manager, check if they have the required permissions
					this._permissionsGuard.canActivate(route, state).subscribe((hasPermissions) => {
						if (hasPermissions) {
							observer.next(true);
						} else {
							// Redirect if neither manager check nor permissions pass
							this._router.navigate([route.data['permissions'].redirectTo || '/pages/dashboard']);
							observer.next(false);
						}
						observer.complete();
					});
				}
			});
		});
	}
}
