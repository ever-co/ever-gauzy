// src/app/permissions.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { AuthService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class PermissionsGuard {
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

		// No permissions required, allow access
		if (!permissions || (permissions.only && permissions.only.length === 0)) {
			return of(true);
		}

		// Retrieve required permissions from route
		const requiredPermissions = this.getRequiredPermissions(permissions, route);
		// Check if required permissions are valid
		if (!requiredPermissions) {
			return of(false); // Block access if permissions aren't valid
		}

		// Determine redirect path
		const redirectTo = this.getRedirectPath(permissions, route, state);

		// Check if the user has the necessary permissions
		return this._authService.hasPermissions(...requiredPermissions).pipe(
			map((hasPermission) => {
				if (hasPermission) {
					return true;
				}
				this._router.navigate([redirectTo]);
				return false;
			}),
			catchError(() => {
				this._router.navigate([redirectTo]);
				return of(false);
			})
		);
	}

	/**
	 * Retrieve the required permissions from the route.
	 *
	 * @param {any} permissions - The permissions object from the route.
	 * @param {ActivatedRouteSnapshot} route - The current route.
	 * @returns {PermissionsEnum[] | null} - An array of required permissions or null if invalid.
	 */
	private getRequiredPermissions(permissions: any, route: ActivatedRouteSnapshot): PermissionsEnum[] | null {
		let requiredPermissions: PermissionsEnum[] | null = null;

		// Check if permissions.only is a function
		if (typeof permissions.only === 'function') {
			requiredPermissions = permissions.only(route) || [];
		} else {
			requiredPermissions = permissions.only || [];
		}

		// Ensure it's an array
		if (!Array.isArray(requiredPermissions)) {
			console.error('Expected permissions.only to be an array but received:', requiredPermissions);
			return null; // Block access if permissions aren't valid
		}

		return requiredPermissions;
	}

	/**
	 * Determine the redirect path based on permissions configuration.
	 *
	 * @param {any} permissions - The permissions object from the route.
	 * @param {ActivatedRouteSnapshot} route - The current route.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @returns {string} - The redirect path or the default redirection path.
	 */
	private getRedirectPath(permissions: any, route: ActivatedRouteSnapshot, state: RouterStateSnapshot): string {
		const defaultRedirectTo = '/pages/dashboard'; // Default redirection path

		// Check if redirectTo is a function and call it
		if (typeof permissions.redirectTo === 'function') {
			return permissions.redirectTo(route, state) || defaultRedirectTo; // Fallback to default
		}

		// Return the specified redirectTo or the default
		return permissions.redirectTo || defaultRedirectTo;
	}
}
