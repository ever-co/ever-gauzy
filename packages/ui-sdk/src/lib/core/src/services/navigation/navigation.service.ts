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
	async navigate(
		route: string[] = [],
		queryParams: { [key: string]: string | string[] | boolean },
		queryParamsHandling: QueryParamsHandling = 'merge'
	): Promise<void> {
		await this.router.navigate(route, {
			relativeTo: this.activatedRoute,
			queryParams,
			queryParamsHandling
		});
	}
}
