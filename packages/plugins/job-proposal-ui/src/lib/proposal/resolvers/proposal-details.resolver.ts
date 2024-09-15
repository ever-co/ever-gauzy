import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { IProposal } from '@gauzy/contracts';
import { ProposalsService } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch a proposal by its ID.
 * If an error occurs, the user is redirected to the employees page.
 *
 * @param route The activated route snapshot containing the route parameters.
 * @returns An observable that emits the resolved proposal or `null` in case of an error.
 */
export const ProposalDetailsResolver: ResolveFn<Observable<IProposal>> = (
	route: ActivatedRouteSnapshot
): Observable<IProposal> => {
	// Injecting the necessary services
	const _proposalsService = inject(ProposalsService);
	const _router = inject(Router);

	// Extracting proposal ID from route parameters
	const proposalId = route.params['id'];

	// Check if proposal ID is present
	if (!proposalId) {
		// Return an observable emitting null if proposal ID is not present
		return of(null);
	}

	// Get proposal by ID
	return _proposalsService.getById(proposalId, ['employee', 'employee.user', 'tags', 'organizationContact']).pipe(
		catchError(() => {
			// Redirect to the employees page if an error occurs
			_router.navigate(['/pages/employees']);
			// Return an observable emitting null to indicate the failure
			return of(null);
		})
	);
};
