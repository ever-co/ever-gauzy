import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Organization, ProductCategoryTranslated } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, takeUntil } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Location } from '@angular/common';
import { ProductCategoryService } from '../../../@core/services/product-category.service';
import { ProductCategoryMutationComponent } from '../../../@shared/product-mutation/product-category-mutation/product-category-mutation.component';
import { ImageRowComponent } from '../img-row/image-row.component';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';

export interface SelectedProductCategory {
	data: ProductCategoryTranslated;
	isSelected: boolean;
}

@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedItem: ProductCategoryTranslated;
	selectedOrganization: Organization;
	smartTableSource = new LocalDataSource();
	disableButton = true;

	private _ngDestroy$ = new Subject<void>();

	@ViewChild('productCategoriesTable', { static: true })
	productCategoriesTable;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productCategoryService: ProductCategoryService,
		private toastrService: NbToastrService,
		private location: Location,
		private store: Store
	) {
		super(translateService);
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

		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
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
		this.selectedItem = null;
		const searchCriteria = this.selectedOrganization
			? { organization: { id: this.selectedOrganization.id } }
			: null;

		const { items } = await this.productCategoryService.getAll(
			this.store.preferredLanguage,
			['organization'],
			searchCriteria
		);

		this.loading = false;
		this.smartTableSource.load(items);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	async save() {
		const editProductCategory = this.selectedItem
			? await this.productCategoryService.getById(this.selectedItem.id)
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
		this.selectedItem = null;
		this.disableButton = true;

		if (productCategory) {
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.productCategoryService.delete(this.selectedItem.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_CATEGORY_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	selectProductCategory($event: SelectedProductCategory) {
		if ($event.isSelected) {
			this.selectedItem = $event.data;
			this.disableButton = false;
			this.productCategoriesTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	goBack() {
		this.location.back();
	}
}
