import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Organization, ProductTypeTranslated } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, takeUntil } from 'rxjs/operators';
import { ProductTypeMutationComponent } from '../../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Location } from '@angular/common';
import { IconRowComponent } from '../icon-row/icon-row.component';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';

export interface SelectedProductType {
	data: ProductTypeTranslated;
	isSelected: boolean;
}

@Component({
	selector: 'ngx-product-type',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedItem: ProductTypeTranslated;
	selectedOrganization: Organization;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('productTypesTable', { static: true }) productTypesTable;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productTypeService: ProductTypeService,
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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				icon: {
					title: this.getTranslation('INVENTORY_PAGE.ICON'),
					width: '5%',
					filter: false,
					type: 'custom',
					renderComponent: IconRowComponent
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

		const { items } = await this.productTypeService.getAllTranslated(
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
		const editProductType = this.selectedItem
			? await this.productTypeService.getById(this.selectedItem.id)
			: null;

		const dialog = this.dialogService.open(ProductTypeMutationComponent, {
			context: {
				productType: editProductType
			}
		});

		const productType = await dialog.onClose.pipe(first()).toPromise();
		this.selectedItem = null;
		this.disableButton = true;

		if (productType) {
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_SAVED'),
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
			await this.productTypeService.delete(this.selectedItem.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	selectProductType($event: SelectedProductType) {
		if ($event.isSelected) {
			this.selectedItem = $event.data;
			this.disableButton = false;
			this.productTypesTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	goBack() {
		this.location.back();
	}
}
