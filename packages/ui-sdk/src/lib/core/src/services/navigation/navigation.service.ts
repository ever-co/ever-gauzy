import { Injectable } from '@angular/core';
import { ActivatedRoute, QueryParamsHandling, Router } from '@angular/router';
import { Location } from '@angular/common';
import { isNotNullOrUndefinedOrEmpty } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class NavigationService {
	constructor(
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute,
		private readonly location: Location
	) {}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	async navigateQueryParams(
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

	/**
	 * Updates the query parameters of the current route without navigating away.
	 *
	 * @param queryParams The query parameters to be updated.
	 * @param queryParamsHandling The strategy to handle the query parameters (default is 'merge').
	 */
	async updateQueryParams(
		queryParams: { [key: string]: string | string[] | boolean },
		queryParamsHandling: QueryParamsHandling = 'merge'
	): Promise<void> {
		const currentUrl = this.location.path();
		const [currentUrlTree, currentQueryParamsString] = currentUrl.split('?'); // Split current URL to get the path and query params

		let existingQueryParams: { [key: string]: string | string[] | boolean } = {};

		if (currentQueryParamsString) {
			// Parse existing query params from current URL
			const urlSearchParams = new URLSearchParams(currentQueryParamsString);
			urlSearchParams.forEach((value, key) => {
				if (existingQueryParams[key]) {
					if (Array.isArray(existingQueryParams[key])) {
						(existingQueryParams[key] as string[]).push(value);
					} else {
						existingQueryParams[key] = [existingQueryParams[key] as string, value];
					}
				} else {
					existingQueryParams[key] = value;
				}
			});
		}

		//
		const mergeQueryParams = { ...existingQueryParams, ...queryParams };

		// Merge existing query params with new query params if handling is 'merge'
		const finalQueryParams = queryParamsHandling === 'merge' ? mergeQueryParams : queryParams;

		// Ensure the query parameters are unique
		const uniqueQueryParams: { [key: string]: string | string[] | boolean } = {};
		for (const key in finalQueryParams) {
			const value = finalQueryParams[key];
			if (isNotNullOrUndefinedOrEmpty(value)) {
				if (Array.isArray(value)) {
					uniqueQueryParams[key] = Array.from(new Set(value));
				} else {
					uniqueQueryParams[key] = value;
				}
			}
		}

		const queryParamsString = this.createQueryParamsString(uniqueQueryParams); // Convert query params object to string
		const newUrl = `${currentUrlTree}?${queryParamsString}`; // Combine current URL with updated query params

		// Replace the browser's URL without triggering navigation
		this.location.replaceState(newUrl);
	}

	/**
	 * Creates a query parameters string from an object of query parameters.
	 * @param queryParams An object containing query parameters.
	 * @returns A string representation of the query parameters.
	 */
	private createQueryParamsString(queryParams: { [key: string]: string | string[] | boolean }): string {
		return Object.keys(queryParams)
			.map((key) => {
				const value = queryParams[key];
				if (Array.isArray(value)) {
					return value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
				} else {
					return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
				}
			})
			.join('&');
	}
}
