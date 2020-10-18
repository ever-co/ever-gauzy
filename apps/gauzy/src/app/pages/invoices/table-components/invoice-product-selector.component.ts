import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganization, IProduct } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { filter } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ProductService } from '../../../@core/services/product.service';
import { DefaultEditor } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
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
export class InvoiceProductsSelectorComponent
	extends DefaultEditor
	implements OnInit, OnDestroy {
	product: IProduct;
	products: IProduct[];
	private _ngDestroy$ = new Subject<void>();
	selectedLanguage: string;
	organization: IOrganization;

	constructor(
		private store: Store,
		private productService: ProductService,
		private translateService: TranslateService
	) {
		super();
	}

	ngOnInit() {
		this.selectedLanguage = this.translateService.currentLang;
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.organization = organization;
				this._loadProducts();
			});
	}

	private async _loadProducts() {
		if (this.organization) {
			const organizationId = this.organization.id;
			const products = await this.productService.getAll(
				[],
				{ organizationId },
				this.selectedLanguage
			);
			this.products = products.items;
			const product = this.products.find(
				(p) => p.id === this.cell.newValue
			);
			this.product = product;
		}
	}

	selectProduct($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
