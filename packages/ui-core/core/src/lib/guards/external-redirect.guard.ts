import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
	providedIn: 'root'
})
export class ExternalRedirectGuard implements CanActivate {
	/**
	 * Checks if navigation can proceed.
	 *
	 * @param route - The activated route snapshot containing route parameters.
	 * @returns {boolean} - Returns false to prevent navigation to the route and true to allow navigation.
	 */
	canActivate(route: ActivatedRouteSnapshot): boolean {
		const externalUrl = route.paramMap.get('redirect');

		// If an external URL is provided in the route parameters
		if (externalUrl) {
			window.open(externalUrl, '_blank'); // Open the URL in a new tab
			return false; // Prevent navigation to the current route
		}

		return true; // Allow navigation if no external URL is found
	}
}
