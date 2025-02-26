import { Component, OnInit, OnDestroy } from '@angular/core';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DefaultEditor } from 'angular2-smart-table';
import { IOrganization, IProduct, IProductTranslatable } from '@gauzy/contracts';
import { ProductService, Store, TranslatableService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    template: `
		<nb-select
			fullWidth
			[placeholder]="'INVOICES_PAGE.SELECT_PRODUCT' | translate"
			[(ngModel)]="product"
			(selectedChange)="selectProduct($event)"
		>
			<nb-option *ngFor="let product of products" [value]="product">
				{{ geProductTranslatedName(product) }}
			</nb-option>
		</nb-select>
	`,
    styles: [],
    standalone: false
})
export class InvoiceProductsSelectorComponent extends DefaultEditor implements OnInit, OnDestroy {
	public product: IProductTranslatable;
	public products: IProductTranslatable[];
	public selectedLanguage: string;
	public organization: IOrganization;

	constructor(
		private readonly store: Store,
		private readonly productService: ProductService,
		private readonly translateService: TranslateService,
		private readonly translatableService: TranslatableService
	) {
		super();
	}

	ngOnInit() {
		this.selectedLanguage = this.translateService.currentLang;
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
				this._loadProducts();
			});
	}

	geProductTranslatedName(product: IProductTranslatable) {
		return this.translatableService.getTranslatedProperty(product, 'name');
	}

	private async _loadProducts() {
		const organizationId = this.organization.id;
		const tenantId = this.store.user.tenantId;
		this.productService
			.getAll(['translations'], { organizationId, tenantId }, this.selectedLanguage)
			.then(({ items }) => {
				this.products = items;
				const product: IProduct = this.cell.getNewRawValue();
				this.product = this.products.find((p) => p.id === product.id);
			});
	}

	/**
	 *
	 * @param $event
	 */
	selectProduct($event) {
		this.cell.setValue($event);
	}

	ngOnDestroy() {}
}
