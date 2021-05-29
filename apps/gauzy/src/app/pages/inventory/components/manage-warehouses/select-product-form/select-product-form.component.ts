import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { IProductTranslated, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, ProductService, API_PREFIX } from 'apps/gauzy/src/app/@core';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent, ServerDataSource } from 'ng2-smart-table';
import { ImageRowComponent } from '../../table-components/image-row.component';
import { NbDialogRef } from '@nebular/theme';
import { SelectedRowComponent } from '../../table-components/selected-row.component';
import { HttpClient } from '@angular/common/http';

export interface SelectedRowEvent {
	data: IProductTranslated,
	isSelected: boolean,
	selected: IProductTranslated[]
}

@UntilDestroy()
@Component({
	selector: 'ngx-select-product',
	templateUrl: './select-product-form.component.html',
	styleUrls: ['./select-product-form.component.scss']
})
export class SelectProductComponent
	extends TranslationBaseComponent implements OnInit {
	products: IProductTranslated[] = [];
	settingsSmartTable: object;
	organization: IOrganization;
	loading: boolean = true;
	smartTableSource: ServerDataSource;
	selectedLanguage: string = LanguagesEnum.ENGLISH;


	selectedRows: any[] = [];
	tableData: any[] = [];

	productsTable: Ng2SmartTableComponent;

	@ViewChild('productsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.productsTable = content;
		}
	}
	PRODUCTS_URL = `${API_PREFIX}/products/local/${this.selectedLanguage}?`;


	constructor(
		public dialogRef: NbDialogRef<any>,
		private store: Store,
		readonly translateService: TranslateService,
		private productService: ProductService,
		private http: HttpClient
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSettings();
		this.loadSmartTable();
		this.selectedLanguage = this.store.preferredLanguage;


		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadSettings();
				}
			});
	}

	translateProp(elem, prop) {
		let translations = elem.translations;

		if (!translations) return '-';

		return translations.find(
			(tr) => tr.languageCode == this.store.preferredLanguage
		)[prop];
	}

	async loadSettings() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization || { id: '' };

		const data = "data=" + JSON.stringify({
			relations: ['type', 'category', 'featuredImage', 'variants'],
			findInput: { organizationId, tenantId },
		});


		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: this.PRODUCTS_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});

		this.loading = false;
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			pager: {
				perPage: 5
			},
			actions: false,
			columns: {
				selected: {
					title: this.getTranslation('INVENTORY_PAGE.SELECTED'),
					type: 'custom',
					valuePrepareFunction: (cell, row) => {
						row.selected = !!this.selectedRows.find(p => p.id == row.id);
					}, 
					renderComponent: SelectedRowComponent
				},
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

	onUserRowSelect(event: SelectedRowEvent) {
		if(event.isSelected && !this.selectedRows.find(p => p.id == event.data.id)) {
			this.selectedRows.push(event.data)
		}
	}
}
