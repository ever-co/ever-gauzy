import {
	IProductCategoryTranslated,
	IOrganization,
	LanguagesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { Subject } from 'rxjs';
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
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedProductCategory: IProductCategoryTranslated;
	productData: IProductCategoryTranslated[];
	selectedOrganization: IOrganization;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	private _ngDestroy$ = new Subject<void>();

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
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productCategoryService: ProductCategoryService,
		private toastrService: ToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
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
		const searchCriteria = {
			organization: { id: organizationId },
			tenantId
		};
		const { items } = await this.productCategoryService.getAllTranslated(
			this.store.preferredLanguage || LanguagesEnum.ENGLISH,
			['organization'],
			searchCriteria
		);

		this.loading = false;
		this.productData = items;
		this.smartTableSource.load(items);
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

	ngOnDestroy(): void {}
}
