import {
	IProductCategoryTranslated,
	IOrganization,
	ComponentLayoutStyleEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { Ng2SmartTableComponent, ServerDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { ProductCategoryService } from '../../../../@core/services/product-category.service';
import { Store } from '../../../../@core/services/store.service';
import { first, tap } from 'rxjs/operators';
import { ImageRowComponent } from '../table-components/image-row.component';
import { ProductCategoryMutationComponent } from '../../../../@shared/product-mutation/product-category-mutation/product-category-mutation.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { NgxPermissionsService } from 'ngx-permissions';
import { API_PREFIX } from 'apps/gauzy/src/app/@core';
import { HttpClient } from '@angular/common/http';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent
	extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedProductCategory: IProductCategoryTranslated;
	productData: IProductCategoryTranslated[];
	selectedOrganization: IOrganization;
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	editCategoriesAllowed = false;

	source: ServerDataSource;
	CATEGORIES_URL = `${API_PREFIX}/product-categories?`;

	productCategoriesTable: Ng2SmartTableComponent;
	@ViewChild('productCategoriesTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.productCategoriesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private http: HttpClient, 
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productCategoryService: ProductCategoryService,
		private toastrService: ToastrService,
		private ngxPermissionsService: NgxPermissionsService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.setPermissions();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganization = org;
					this.loadSettings();
				}
			});
		this.store.preferredLanguage$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				if (this.selectedOrganization) {
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

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.productCategoriesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_CATEGORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: 10
			},
			columns: {
				imageUrl: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					width: '10%',
					filter: false,
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string',
					width: '40%'
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	async loadSettings() {
		this.selectedProductCategory = null;
		const { id: organizationId, tenantId } = this.selectedOrganization;

		const data = "data=" + JSON.stringify({
			relations: ['organization'],
			findInput: {
				organization: { id: organizationId },
				tenantId
			},
		});

		this.source = new ServerDataSource(this.http, {
			endPoint: this.CATEGORIES_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});
		this.loading = false;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	async save(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}
		const editProductCategory = this.selectedProductCategory
			? await this.productCategoryService.getById(
					this.selectedProductCategory.id
			  )
			: null;

		const dialog = this.dialogService.open(
			ProductCategoryMutationComponent,
			{
				context: {
					productCategory: editProductCategory
				}
			}
		);

		const productCategory = await dialog.onClose.pipe(first()).toPromise();
		this.selectedProductCategory = null;
		this.disableButton = true;
		if (productCategory) {
			let productCatTranslaction = productCategory.translations[0];
			this.toastrService.success(
				'INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED',
				{
					name: productCatTranslaction?.name
				}
			);
		}

		this.loadSettings();
	}

	async delete(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.productCategoryService.delete(
				this.selectedProductCategory.id
			);

			this.toastrService.success(
				'INVENTORY_PAGE.PRODUCT_CATEGORY_DELETED',
				{
					name: this.selectedProductCategory.name
				}
			);

			this.loadSettings();
		}
		this.disableButton = true;
	}

	selectProductCategory({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProductCategory = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProductCategory({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.productCategoriesTable && this.productCategoriesTable.grid) {
			this.productCategoriesTable.grid.dataSet['willSelect'] = 'false';
			this.productCategoriesTable.grid.dataSet.deselectAll();
		}
	}

	async setPermissions() {
		this.editCategoriesAllowed = await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.ORG_PRODUCT_CATEOGIES_EDIT
		);
	}
}
