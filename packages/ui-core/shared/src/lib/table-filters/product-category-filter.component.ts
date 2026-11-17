import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { IProductCategoryTranslated } from '@gauzy/contracts';

@Component({
	selector: 'ga-product-category-select-filter',
	template: `
		<ngx-product-category-selector
			[ngModel]="restored?.id"
			[placeholder]="'INVENTORY_PAGE.PRODUCT_CATEGORY' | translate"
			[addTag]="false"
			[label]="''"
			(onChanged)="selectedProductCategoryEvent($event)"
		></ngx-product-category-selector>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ProductCategoryFilterComponent extends RestorableFilterComponent implements OnChanges {
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
		this.applyFilter(value);
	}
}
