import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
import { IOrganization } from '../../../../../../../packages/contracts/dist/organization.model';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-amount',
	template: `<span>{{
		value
			| currency: rowData?.currency
			| position: organization.currencyPosition
	}}</span>`
})
export class InvoiceEstimateTotalValueComponent implements OnInit, OnDestroy {
	@Input() value: Date;

	@Input()
	rowData: any;

	organization: IOrganization;

	constructor(private store: Store) {}

	ngOnInit(): void {
		const organization$ = this.store.selectedOrganization$;
		organization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => {
					this.organization = organization;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
