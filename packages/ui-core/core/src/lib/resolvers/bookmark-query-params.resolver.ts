import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { EMPTY, Observable, of } from 'rxjs';
import { Store } from '../services/store/store.service';
import { DEFAULT_SELECTOR_VISIBILITY } from '../services/selector-builder/selector-builder.service';

/**
 * The `BookmarkQueryParamsResolver` is responsible for constructing a set of query parameters
 * based on selected entities such as organization, employee, project, and team.
 * It retrieves the necessary state using injected services (`Store` and `SelectorBuilderService`)
 * and dynamically builds the query parameters if the respective selectors are active.
 *
 * @returns {Observable<Record<string, string>>} - An observable that emits a set of query parameters
 * with entity IDs mapped to their respective keys (e.g., `organizationId`, `employeeId`, etc.).
 * If there is an error or no matching selectors, an empty observable is returned.
 */
export const BookmarkQueryParamsResolver: ResolveFn<Observable<Record<string, string>>> = (
	route: ActivatedRouteSnapshot
): Observable<Record<string, string>> => {
	try {
		// Get selectors visibility and selected entities
		const selectors = Object.assign({}, DEFAULT_SELECTOR_VISIBILITY, route.data?.selectors);

		// Get injected services
		const _store = inject(Store);
		const { selectedOrganization, selectedEmployee, selectedProject, selectedTeam } = _store;

		// Map selectors to entity IDs
		const paramMappings: Record<string, string | undefined> = {
			organizationId: selectedOrganization?.id,
			employeeId: selectedEmployee?.id,
			projectId: selectedProject?.id,
			teamId: selectedTeam?.id
		};

		// Create queryParams by filtering out undefined values and matching selectors
		const queryParams: Record<string, string> = Object.entries(paramMappings).reduce((params, [key, value]) => {
			if (selectors[key.replace('Id', '')] && value) {
				params[key] = value;
			}
			return params;
		}, {});

		// Return null if organization ID is missing
		return of(queryParams); // Allow the route to resolve normally
	} catch (error) {
		// Handle any synchronous errors and redirect to "new integration" page
		console.log(`Error resolving entity query params: ${error}`);
		// Return an empty observable
		return EMPTY;
	}
};
