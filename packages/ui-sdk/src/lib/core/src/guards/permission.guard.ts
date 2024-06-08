// src/app/permissions.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, CanActivateChild } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class PermissionsGuard implements CanActivate, CanActivateChild {
	constructor(private readonly _authService: AuthService, private readonly _router: Router) {}

	/**
	 * Asynchronously checks if the user is allowed to activate the route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route being navigated to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Observable<boolean>} A promise that resolves to a boolean indicating whether the user is allowed to activate the route.
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		return this._hasPermissions(route, state);
	}

	/**
	 * Checks if the user is allowed to activate the child routes.
	 *
	 * @param {ActivatedRouteSnapshot} childRoute - The child route being navigated to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Observable<boolean>} An observable that resolves to a boolean indicating whether the user is allowed to activate the child routes.
	 */
	canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		return this._hasPermissions(childRoute, state);
	}

	/**
	 * Helper method to check permissions.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route being navigated to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Observable<boolean>} An observable that resolves to a boolean indicating whether the user is allowed to activate the route.
	 */
	private _hasPermissions(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		const permissions = route.data['permissions'];
		const defaultRedirectTo = '/pages/dashboard'; // Default redirection path

		if (!permissions || (permissions.only && permissions.only.length === 0)) {
			return of(true); // No permissions required, allow access
		}

		// Check if the user has the necessary permissions
		const isFunction = typeof permissions.redirectTo === 'function';
		const redirectTo = isFunction ? permissions.redirectTo(route, state) : permissions.redirectTo;

		// Check if the user has the necessary permissions
		return this._authService.hasPermissions(...permissions.only).pipe(
			map((hasPermission) => {
				if (hasPermission) {
					return true;
				} else {
					this._router.navigate([redirectTo || defaultRedirectTo]);
					return false;
				}
			}),
			catchError(() => {
				this._router.navigate([redirectTo || defaultRedirectTo]);
				return of(false);
			})
		);
	}
}
