import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, from, Observable, of as observableOf } from 'rxjs';
import { IProposal } from '@gauzy/contracts';
import { ProposalsService } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class ProposalEditOrDetailsResolver implements Resolve<Observable<IProposal>> {
	constructor(private readonly proposalsService: ProposalsService, private readonly router: Router) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IProposal> {
		try {
			const proposalId = route.params.id;
			return from(
				this.proposalsService
					.getById(proposalId, ['employee', 'employee.user', 'tags', 'organizationContact'])
					.pipe(
						catchError((error) => {
							return observableOf(error);
						})
					)
			);
		} catch (error) {
			this.router.navigate(['/pages/employees']);
		}
	}
}
