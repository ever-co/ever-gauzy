import { Component, Input, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-total-amount',
	template: `
		<ng-container *ngIf="isArray(rowData); else singleValue">
			<div *ngFor="let amount of rowData">
				{{
					amount.totalValue
						| currency : amount.currency : 'code' : '1.0-4'
						| position : organization?.currencyPosition
				}}
			</div>
		</ng-container>

		<ng-template #singleValue>
			<span>
				{{
					value | currency : rowData?.currency : 'code' : '1.0-4' | position : organization?.currencyPosition
				}}
			</span>
		</ng-template>
	`,
	standalone: false
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

	isArray(value: any): boolean {
		return Array.isArray(value);
	}
}
