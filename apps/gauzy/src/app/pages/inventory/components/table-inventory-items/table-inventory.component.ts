import { Component, OnInit, ViewChild } from '@angular/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { first, tap } from 'rxjs/operators';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import {
	IProduct,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProductTranslated,
	PermissionsEnum,
	LanguagesEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProductService } from '../../../../@core/services/product.service';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Store } from '../../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { ItemImgTagsComponent } from '../table-components/item-img-tags-row.component';
import { NgxPermissionsService } from 'ngx-permissions';
import { ServerDataSource } from 'ng2-smart-table';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from 'apps/gauzy/src/app/@core';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-table-inventory',
	templateUrl: './table-inventory.component.html',
	styleUrls: ['./table-inventory.component.scss']
})
export class TableInventoryComponent
	extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading: boolean;
	selectedProduct: IProduct;
	form: FormGroup;
	selectedLanguage: string = LanguagesEnum.ENGLISH;
	inventoryData: IProductTranslated[] = [];
	disableButton: boolean = true;
	viewComponentName: ComponentEnum = ComponentEnum.INVENTORY;
	dataLayoutStyle: ComponentLayoutStyleEnum = ComponentLayoutStyleEnum.CARDS_GRID;
	organization: IOrganization;

	editProductAllowed: boolean = false;
	viewCategoriesAllowed: boolean = false;
	viewTypesAllowed: boolean = false;

	source: ServerDataSource;
	PRODUCTS_URL = `${API_PREFIX}/products/local/${this.selectedLanguage}?`;

	currentPage: number = 0;
	totalItems: number = 0;

	inventoryTable: Ng2SmartTableComponent;
	@ViewChild('inventoryTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.inventoryTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private http: HttpClient,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private productService: ProductService,
		private router: Router,
		private store: Store,
		private ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this.setPermissions();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.selectedLanguage = this.store.preferredLanguage;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization || { id: '' };

		this.productService.count({ findInput: { organizationId, tenantId } }).then(res => {
			this.totalItems = res as any;
		});


		this.store.preferredLanguage$
			.pipe(untilDestroyed(this))
			.subscribe((lang) => {
				this.selectedLanguage = lang;
				this.loadSettings();
			});


		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadSettings();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});

	}

	setView() {
		this.viewComponentName = ComponentEnum.INVENTORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: 10
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
				type: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string',
					valuePrepareFunction: (type: string) => {
						return type ? type : '-';
					}
				},
				category: {
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
				},

			}
		};
	}

	onPageChange(pageNum) {
		this.currentPage = pageNum;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization || { id: '' };

		const options = {
			relations: ['type', 'category', 'tags', 'featuredImage'],
			findInput: { organizationId, tenantId }
		};

		this.productService.getAllTranslated(options,
			{ page: pageNum, _limit: 10 },
			this.store.preferredLanguage
		).then(res => {
			if (res && res.items) {
				this.inventoryData = res.items;
			}
		});
	}

	manageProductTypes() {
		this.router.navigate(['/pages/organization/inventory/product-types']);
	}

	manageProductCategories() {
		this.router.navigate([
			'/pages/organization/inventory/product-categories'
		]);
	}

	manageWarehouses() {
		this.router.navigate(['/pages/organization/inventory/warehouses/all']);
	}


	manageStores() {
		this.router.navigate(['/pages/organization/inventory/merchants/all']);
	}

	onAddInventoryItem() {
		this.router.navigate([`/pages/organization/inventory/create`]);
	}

	onEditInventoryItem(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			`/pages/organization/inventory/edit/${this.selectedProduct.id}`
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
			`/pages/organization/inventory/view/${this.selectedProduct.id}`
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
				this.loadSettings();
				this.toastrService.success(
					'INVENTORY_PAGE.INVENTORY_ITEM_DELETED',
					{
						name: this.selectedProduct.name
					}
				);
			}
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		} finally {
			this.clearItem();
		}
	}

	async loadSettings() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization || { id: '' };

		const data = "data=" + JSON.stringify({
			relations: ['type', 'category', 'tags', 'featuredImage'],
			findInput: { organizationId, tenantId },
		});

		this.productService.count({ findInput: { organizationId, tenantId } }).then(res => {
			this.totalItems = res as any;
		});


		this.source = new ServerDataSource(this.http, {
			endPoint: this.PRODUCTS_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});

		this.loading = false;
	}

	async selectProduct({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProduct = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
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

	async setPermissions() {
		this.editProductAllowed = await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT
		);
		this.viewCategoriesAllowed = await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW
		);
		this.viewTypesAllowed = await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.ORG_PRODUCT_TYPES_VIEW
		);
	}
}
