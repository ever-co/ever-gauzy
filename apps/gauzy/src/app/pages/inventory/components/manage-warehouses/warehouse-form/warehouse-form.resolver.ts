import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, EMPTY, from, Observable, of as observableOf } from 'rxjs';
import { IWarehouse } from '@gauzy/contracts';
import { WarehouseService } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class WarehouseFormResolver implements Resolve<Observable<IWarehouse>> {
	constructor(private readonly router: Router, private readonly warehouseService: WarehouseService) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IWarehouse> {
		try {
			const warehouseId = route.params.id;
			return from(this.warehouseService.getById(warehouseId, ['logo', 'contact', 'tags'])).pipe(
				catchError((error) => {
					return observableOf(error);
				})
			);
		} catch (error) {
			this.router.navigate(['/pages/organization/inventory/warehouses']);
			return from(EMPTY);
		}
	}
}
