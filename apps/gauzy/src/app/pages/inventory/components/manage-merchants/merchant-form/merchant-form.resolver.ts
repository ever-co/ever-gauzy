import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, EMPTY, from, Observable, of as observableOf } from 'rxjs';
import { IMerchant } from '@gauzy/contracts';
import { MerchantService } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class MerchantFormResolver implements Resolve<Observable<IMerchant>> {
	constructor(private readonly router: Router, private readonly merchantService: MerchantService) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IMerchant> {
		try {
			const warehouseId = route.params.id;
			return from(this.merchantService.getById(warehouseId, ['logo', 'contact', 'warehouses', 'tags'])).pipe(
				catchError((error) => {
					return observableOf(error);
				})
			);
		} catch (error) {
			this.router.navigate(['/pages/organization/inventory/merchants']);
			return from(EMPTY);
		}
	}
}
