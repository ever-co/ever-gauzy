import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { IProductTranslated, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, ProductService } from 'apps/gauzy/src/app/@core';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { ImageRowComponent } from '../../table-components/image-row.component';
import { NbDialogRef } from '@nebular/theme';

@UntilDestroy()
@Component({
	selector: 'ngx-select-product',
	templateUrl: './select-product-form.component.html',
	styleUrls: ['./select-product-form.component.scss']
})
export class SelectProductComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	products: IProductTranslated[] = [];
	settingsSmartTable: object;
	organization: IOrganization;
	loading: boolean = true;
	smartTableSource = new LocalDataSource();

	selectedRows: any[];

	productsTable: Ng2SmartTableComponent;

	@ViewChild('productsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.productsTable = content;
		}
	}

	constructor(
		public dialogRef: NbDialogRef<any>,
		private store: Store,
		readonly translateService: TranslateService,
		private productService: ProductService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSmartTable();

		this.loadItems();
		this.smartTableSource.setPaging(5, 5, false);

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadItems();
				}
			});
	}

	ngOnDestroy() {}

	translateProp(elem, prop) {
		let translations = elem.translations;

		if (!translations) return '-';

		return translations.find(
			(tr) => tr.languageCode == this.store.preferredLanguage
		)[prop];
	}

	async loadItems() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.productService.getAllTranslated(
			['type', 'category', 'featuredImage', 'variants'],
			{ organizationId, tenantId },
			this.store.preferredLanguage
		);

		this.loading = false;
		this.products = items;

		let mappedItems = items.map((item) => {
			return {
				...item,
				id: item.id,
				name: item.name,
				category: item.category,
				type: item.type,
				featuredImage: item.featuredImage
			};
		});

		this.smartTableSource.load(mappedItems);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			selectMode: 'multi',
			actions: true,
			pager: {
				perPage: 5
			},
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string'
				},
				type: {
					title: this.getTranslation('INVENTORY_PAGE.TYPE'),
					type: 'string'
				},
				category: {
					title: this.getTranslation('INVENTORY_PAGE.CATEGORY'),
					type: 'string'
				}
			}
		};
	}

	onUserRowSelect(data) {
		this.selectedRows = data.selected;
	}
}
