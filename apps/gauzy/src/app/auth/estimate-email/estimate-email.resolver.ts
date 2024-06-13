import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, Observable, of as observableOf } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { EstimateEmailService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class EstimateEmailResolver implements Resolve<Observable<IEstimateEmail | Observable<never>>> {
	constructor(private readonly estimateEmailService: EstimateEmailService) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IEstimateEmail | Observable<never>> {
		const token = route.queryParamMap.get('token');
		const email = route.queryParamMap.get('email');
		return this.estimateEmailService
			.validate({
				email,
				token
			})
			.pipe(
				catchError((error) => {
					console.log('Handling error locally and rethrowing it...', error);
					return observableOf(error);
				})
			);
	}
}
