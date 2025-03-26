import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IProductCategoryTranslated } from '@gauzy/contracts';

@Component({
	selector: 'ga-product-category-select-filter',
	template: `
		<ngx-product-category-selector
			[placeholder]="'INVENTORY_PAGE.PRODUCT_CATEGORY' | translate"
			[addTag]="false"
			[label]="''"
			(onChanged)="selectedProductCategoryEvent($event)"
		></ngx-product-category-selector>
	`
})
export class ProductCategoryFilterComponent extends DefaultFilter implements OnChanges {
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
	selectedProductCategoryEvent(value: IProductCategoryTranslated) {
		this.column.filterFunction(value, this.column.id);
	}
}
