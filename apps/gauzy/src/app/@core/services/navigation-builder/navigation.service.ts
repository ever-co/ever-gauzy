import { Injectable } from '@angular/core';
import { ActivatedRoute, QueryParamsHandling, Router } from '@angular/router';

@Injectable({
	providedIn: 'root'
})
export class NavigationService {
	constructor(private readonly router: Router, private readonly activatedRoute: ActivatedRoute) {}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	navigate(
		route: string[] = [],
		queryParams: { [key: string]: string | string[] },
		queryParamsHandling: QueryParamsHandling = 'merge'
	): void {
		this.router.navigate(route, {
			relativeTo: this.activatedRoute,
			queryParams,
			queryParamsHandling
		});
	}
}
