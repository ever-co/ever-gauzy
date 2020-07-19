import { Component, OnInit, OnDestroy } from '@angular/core';
import { Product } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ProductService } from '../../../@core/services/product.service';
import { DefaultEditor } from 'ng2-smart-table';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'INVOICES_PAGE.SELECT_PRODUCT' | translate }}"
			[(ngModel)]="product"
			(selectedChange)="selectProduct($event)"
		>
			<nb-option *ngFor="let product of products" [value]="product">
				{{ product.name }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceProductsSelectorComponent extends DefaultEditor
	implements OnInit, OnDestroy {
	product: Product;
	products: Product[];
	private _ngDestroy$ = new Subject<void>();

	constructor(private store: Store, private productService: ProductService) {
		super();
	}

	ngOnInit() {
		this._loadProducts();
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
					const product = this.products.find(
						(p) => p.id === this.cell.newValue
					);
					this.product = product;
				}
			});
	}

	selectProduct($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
