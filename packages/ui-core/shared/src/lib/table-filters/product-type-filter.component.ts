import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { IProductTypeTranslated } from '@gauzy/contracts';

@Component({
	selector: 'ga-product-type-select-filter',
	template: `
		<ngx-product-type-selector
			[ngModel]="restored?.id"
			[placeholder]="'INVENTORY_PAGE.PRODUCT_TYPE' | translate"
			[addTag]="false"
			[label]="''"
			(onChanged)="selectedProductTypeEvent($event)"
		></ngx-product-type-selector>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ProductTypeFilterComponent extends RestorableFilterComponent implements OnChanges {
	constructor() {
		super();
	}

	/**
	 *
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	selectedProductTypeEvent(value: IProductTypeTranslated) {
		this.applyFilter(value);
	}
}
