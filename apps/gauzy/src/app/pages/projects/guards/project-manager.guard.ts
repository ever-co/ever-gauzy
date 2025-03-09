import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { catchError, Observable, of, tap } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';

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
		// Get the project ID from the route parameters
		const projectId = route.paramMap.get('id');
		if (!projectId) {
			this._router.navigate(['/pages/dashboard']);
			return of(false);
		}

		// Check if the user can manage the project
		const canEditProject = this._store.hasAnyPermission(
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_PROJECT_EDIT
		);

		// Check if the user can view the project
		const isAbleToChangeSelectedEmployee = this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Check if the user is an employee
		const employee = this._store.user?.employee;
		// Get the employee ID from the user
		const employeeId = employee?.id;

		// If the user is not an employee and can manage the project, allow access
		if (isAbleToChangeSelectedEmployee && canEditProject) {
			console.log(`✅ Access granted: User (employeeId: ${employee?.id}) is manager of project ${projectId}.`);
			return of(true);
		}

		// Check if the user has the necessary permissions or is a manager of the project
		return this._projectService.isManagerOfProject(projectId, employeeId).pipe(
			tap((isManager) => {
				if (!isManager) {
					this._router.navigate(['/pages/dashboard']); // Redirect to dashboard if not a manager or does not have permission
				}
			}),
			catchError(() => {
				this._router.navigate(['/pages/dashboard']);
				return of(false); // In case of an error, redirect to dashboard
			})
		);
	}
}
