import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	IProduct,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProductTranslated,
	PermissionsEnum
} from '@gauzy/contracts';
import { PaginationFilterBaseComponent } from './../../../../@shared/pagination/pagination-filter-base.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { API_PREFIX, ComponentEnum } from '../../../../@core/constants';
import { ProductService, Store, ToastrService } from '../../../../@core/services';
import { ServerDataSource } from './../../../../@core/utils/smart-table/server.data-source';
import { ItemImgTagsComponent } from '../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-table-inventory',
	templateUrl: './table-inventory.component.html',
	styleUrls: ['./table-inventory.component.scss']
})
export class TableInventoryComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
	
	settingsSmartTable: object;
	loading: boolean;
	selectedProduct: IProduct;
	smartTableSource: ServerDataSource;
	products: IProductTranslated[] = [];
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	permissionsEnum = PermissionsEnum;

	public organization: IOrganization;
	products$: Subject<any> = this.subject$;

	inventoryTable: Ng2SmartTableComponent;
	@ViewChild('inventoryTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.inventoryTable = content;
			this.onChangedSource();
		}
	}

	/*
	* Actions Buttons directive 
	*/
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;

	constructor(
		private readonly http: HttpClient,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly productService: ProductService,
		private readonly router: Router,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit() {
		this.products$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getTranslatedProducts()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		
		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$

		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(300),
				filter(([organization, language]) => !!organization && !!language),
				tap(([ organization ]) => this.organization = organization),
				distinctUntilChange(),
				tap(() => this.products$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.INVENTORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.products$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.inventoryTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: this.pagination.itemsPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: ItemImgTagsComponent,
					valuePrepareFunction: (name: string) => {
						return name || '-';
					}
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string'
				},
				productType: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string',
					valuePrepareFunction: (type: string) => {
						return type ? type : '-';
					}
				},
				productCategory: {
					title: this.getTranslation(
						'INVENTORY_PAGE.PRODUCT_CATEGORY'
					),
					type: 'string',
					valuePrepareFunction: (category: string) => {
						return category ? category : '-';
					}
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (description: string) => {
						return description
							? description.slice(0, 15) + '...'
							: '';
					}
				}
			}
		};
	}

	manageProductTypes() {
		this.router.navigate([
			'/pages/organization/inventory/product-types'
		]);
	}

	manageProductCategories() {
		this.router.navigate([
			'/pages/organization/inventory/product-categories'
		]);
	}

	manageWarehouses() {
		this.router.navigate([
			'/pages/organization/inventory/warehouses'
		]);
	}

	manageStores() {
		this.router.navigate([
			'/pages/organization/inventory/merchants'
		]);
	}

	onAddInventoryItem() {
		this.router.navigate([
			`/pages/organization/inventory/create`
		]);
	}

	onEditInventoryItem(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			`/pages/organization/inventory/edit`, this.selectedProduct.id
		]);
	}

	onViewInventoryItem(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			`/pages/organization/inventory/view`, this.selectedProduct.id
		]);
	}

	async delete(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (!result) return;

		try {
			const res = await this.productService.delete(
				this.selectedProduct.id
			);
			if (res.affected > 0) {
				this.toastrService.success('INVENTORY_PAGE.INVENTORY_ITEM_DELETED', {
					name: this.selectedProduct.name
				});
			}
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		} finally {
			this.products$.next();
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/products/pagination`,
			relations: [
				'productType',
				'productCategory',
				'tags',
				'featuredImage'
			],
			where: {
				...{ organizationId, tenantId }
			},
			resultMap: (product: IProductTranslated) => {
				return Object.assign({}, product);
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * GET product inventory smart table source
	 */
	 private async getTranslatedProducts() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.products = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectProduct({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProduct = isSelected ? data : null;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProduct({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.inventoryTable && this.inventoryTable.grid) {
			this.inventoryTable.grid.dataSet['willSelect'] = 'false';
			this.inventoryTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() { }
}
