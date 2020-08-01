import {
	ProductCategoryTranslated,
	Organization,
	LanguagesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ProductCategoryService } from '../../../../@core/services/product-category.service';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { ImageRowComponent } from '../table-components/image-row.component';
import { ProductCategoryMutationComponent } from '../../../../@shared/product-mutation/product-category-mutation/product-category-mutation.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';

@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedProductCategory: ProductCategoryTranslated;
	productData: ProductCategoryTranslated[];
	selectedOrganization: Organization;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('productCategoriesTable', { static: true })
	productCategoriesTable;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productCategoryService: ProductCategoryService,
		private toastrService: NbToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				this.selectedOrganization = org;
				this.loadSettings();
			});

		this.store.preferredLanguage$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSettings();
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_CATEGORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
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
		const searchCriteria = this.selectedOrganization
			? { organization: { id: this.selectedOrganization.id } }
			: null;

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
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	async save(selectedItem?: ProductCategoryTranslated) {
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
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async delete(selectedItem?: ProductCategoryTranslated) {
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
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_CATEGORY_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	selectProductCategory({ isSelected, data }) {
		const selectedProductCategory = isSelected ? data : null;
		if (this.productCategoriesTable) {
			this.productCategoriesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedProductCategory = selectedProductCategory;
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
