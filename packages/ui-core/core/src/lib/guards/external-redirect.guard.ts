import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
	providedIn: 'root'
})
export class ExternalRedirectGuard implements CanActivate {
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
		const externalUrl = route.paramMap.get('redirect');
		if (externalUrl) {
			window.open(externalUrl, '_blank');
			return false; // Prevent navigation to the external redirect route
		}
		return true; // Allow navigation if no external URL is found
	}
}
