import {Component, OnInit, ViewChild} from '@angular/core';
import {IOrganization, IProductTranslated, LanguagesEnum} from '@gauzy/contracts';
import {UntilDestroy, untilDestroyed} from '@ngneat/until-destroy';
import {API_PREFIX, ProductService, Store} from 'apps/gauzy/src/app/@core';
import {TranslateService} from '@ngx-translate/core';
import {Ng2SmartTableComponent, ServerDataSource} from 'ng2-smart-table';
import {ImageRowComponent} from '../../inventory-table-components/image-row.component';
import {NbDialogRef} from '@nebular/theme';
import {SelectedRowComponent} from '../../inventory-table-components/selected-row.component';
import {HttpClient} from '@angular/common/http';
import {tap} from 'rxjs/operators';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from "../../../../../@shared/pagination/pagination-filter-base.component";
import {debounceTime} from "rxjs";
import {distinctUntilChange} from "@gauzy/common-angular";

export interface SelectedRowEvent {
	data: IProductTranslated,
	isSelected: boolean,
	selected: IProductTranslated[]
}

@UntilDestroy() @Component({
	selector: 'ngx-select-product',
	templateUrl: './select-product-form.component.html',
	styleUrls: ['./select-product-form.component.scss']
})
export class SelectProductComponent extends PaginationFilterBaseComponent implements OnInit {
	products: IProductTranslated[] = [];
	settingsSmartTable: object;
	organization: IOrganization;
	loading: boolean = true;
	smartTableSource: ServerDataSource;
	selectedLanguage: string = LanguagesEnum.ENGLISH;

	selectedRows: any[] = [];
	tableData: any[] = [];

	productsTable: Ng2SmartTableComponent;
	PRODUCTS_URL = `${API_PREFIX}/products/local/${this.selectedLanguage}?`;

	constructor(public dialogRef: NbDialogRef<any>, private store: Store, readonly translateService: TranslateService, private productService: ProductService, private http: HttpClient) {
		super(translateService);
	}

	@ViewChild('productsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.productsTable = content;
			this.onChangedSource();
		}
	}

	ngOnInit() {
		this.loadSettings();
		this.loadSmartTable();
		this.selectedLanguage = this.store.preferredLanguage;

		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadSettings();
				}
			});
		this.pagination$.pipe(
			debounceTime(100),
			distinctUntilChange(),
			tap(() => this.loadSettings()),
			untilDestroyed(this)
		).subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.productsTable.source.onChangedSource
			.pipe(untilDestroyed(this), tap(() => this.deselectAll()))
			.subscribe();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.productsTable && this.productsTable.grid) {
			this.productsTable.grid.dataSet['willSelect'] = 'false';
			this.productsTable.grid.dataSet.deselectAll();
		}
	}

	translateProp(elem, prop) {
		let translations = elem.translations;

		if (!translations) return '-';

		return translations.find((tr) => tr.languageCode == this.store.preferredLanguage)[prop];
	}

	async loadSettings() {
		this.loading = true;
		const {tenantId} = this.store.user;
		const {id: organizationId} = this.organization || {id: ''};

		const data = "data=" + JSON.stringify({
			relations: ['productType', 'productCategory', 'featuredImage', 'variants'],
			findInput: {organizationId, tenantId},
		});
		const {activePage, itemsPerPage} = this.getPagination();
		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: this.PRODUCTS_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		await this.smartTableSource.getElements();
		this.setPagination({...this.getPagination(), totalItems: this.smartTableSource.count()});
		this.loading = false;
	}

	async loadSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			actions: false,
			columns: {
				selected: {
					title: this.getTranslation('INVENTORY_PAGE.SELECTED'),
					type: 'custom',
					valuePrepareFunction: (cell, row) => {
						row.selected = !!this.selectedRows.find(p => p.id == row.id);
					},
					filter: false,
					renderComponent: SelectedRowComponent
				}, image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					filter: false,
					renderComponent: ImageRowComponent
				}, name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'), type: 'string'
				}, type: {
					title: this.getTranslation('INVENTORY_PAGE.TYPE'), type: 'string'
				}, category: {
					title: this.getTranslation('INVENTORY_PAGE.CATEGORY'), type: 'string'
				}
			}
		};
	}

	onUserRowSelect(event: SelectedRowEvent) {
		if (event.isSelected && !this.selectedRows.find(p => p.id == event.data.id)) {
			this.selectedRows.push(event.data)
		}
	}
}
