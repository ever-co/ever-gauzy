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
	const _proposalsService = inject(ProposalsService);
	const _router = inject(Router);

	const proposalId = route.params['id'];

	if (!proposalId) {
		return of(null);
	}

	return _proposalsService.getById(proposalId, ['employee', 'employee.user', 'tags', 'organizationContact']).pipe(
		catchError(() => {
			_router.navigate(['/pages/employees']);
			return of(null);
		})
	);
};
