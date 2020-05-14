import { Component, OnInit, OnDestroy } from '@angular/core';
import { Product } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ProductService } from '../../../@core/services/product.service';

@Component({
	template: `
		<ng-select
			[(items)]="products"
			bindName="name"
			placeholder="{{ 'INVOICES_PAGE.SELECT_PROJECT' | translate }}"
			[(ngModel)]="product"
			(change)="selectProduct($event)"
		>
			<ng-template ng-option-tmp let-item="item" let-index="index">
				{{ item.name }}
			</ng-template>
			<ng-template ng-label-tmp let-item="item">
				<div class="selector-template">
					<span>{{ item.name }}</span>
				</div>
			</ng-template>
		</ng-select>
	`,
	styles: []
})
export class InvoiceProductsSelectorComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	product: Product;
	products: Product[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private productService: ProductService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	value: any;
	rowData: any;

	ngOnInit() {
		this._loadProducts();
		this.product = this.rowData.product ? this.rowData.product : null;
	}

	private async _loadProducts() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					const products = await this.productService.getAll([], {
						organizationId: organization.id
					});
					this.products = products.items;
				}
			});
	}

	selectProduct($event) {
		this.rowData.product = $event;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
