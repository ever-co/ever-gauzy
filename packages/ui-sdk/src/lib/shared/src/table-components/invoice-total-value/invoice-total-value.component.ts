import { Component, Input, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-total-amount',
	template: `
		<span>
			{{ value | currency : rowData?.currency | position : organization?.currencyPosition }}
		</span>
	`
})
export class InvoiceTotalValueComponent implements OnInit {
	@Input() value: string;
	@Input() rowData: any;

	public organization: IOrganization;

	constructor(private readonly store: Store) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
