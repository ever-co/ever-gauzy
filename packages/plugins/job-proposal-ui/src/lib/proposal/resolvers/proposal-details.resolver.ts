import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IProposal } from '@gauzy/contracts';
import { ProposalsService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ProposalDetailsResolver implements Resolve<Observable<IProposal>> {
	constructor(readonly proposalsService: ProposalsService, readonly router: Router) {}

	/**
	 * Resolves a proposal by its ID from the route parameters.
	 * If an error occurs during retrieval, the user is redirected to the employees page.
	 *
	 * @param route - The activated route snapshot containing the route parameters.
	 * @returns An observable that emits the resolved proposal or `null` in case of an error.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IProposal | null> {
		const proposalId = route.params.id;

		return this.proposalsService
			.getById(proposalId, ['employee', 'employee.user', 'tags', 'organizationContact'])
			.pipe(
				catchError((error) => {
					// Redirect to the employees page if an error occurs
					this.router.navigate(['/pages/employees']);
					// Return an observable emitting null to indicate the failure
					return of(null);
				})
			);
	}
}
