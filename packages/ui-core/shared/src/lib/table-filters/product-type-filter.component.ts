import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IProductTypeTranslated } from '@gauzy/contracts';

@Component({
	selector: 'ga-product-type-select-filter',
	template: `
		<ngx-product-type-selector
			[placeholder]="'INVENTORY_PAGE.PRODUCT_TYPE' | translate"
			[addTag]="false"
			[label]="''"
			(onChanged)="selectedProductTypeEvent($event)"
		></ngx-product-type-selector>
	`
})
export class ProductTypeFilterComponent extends DefaultFilter implements OnChanges {
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
		this.column.filterFunction(value, this.column.id);
	}
}
