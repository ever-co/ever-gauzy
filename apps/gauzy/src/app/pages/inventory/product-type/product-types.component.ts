import { Component, OnInit, ViewChild } from '@angular/core';
import { ProductType } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ProductTypeService } from '../../../@core/services/product-type.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first } from 'rxjs/operators';
import { ProductTypeMutationComponent } from '../../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Location } from '@angular/common';

export interface SelectedProductType {
	data: ProductType;
	isSelected: boolean;
}

@Component({
	selector: 'ngx-product-type',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedItem: ProductType;
	smartTableSource = new LocalDataSource();
	disableButton = true;

	@ViewChild('productTypesTable') productTypesTable;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productTypeService: ProductTypeService,
		private toastrService: NbToastrService,
		private location: Location
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				// todo replace with product type image
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string'
				}
			}
		};
	}

	async loadSettings() {
		this.selectedItem = null;
		const { items } = await this.productTypeService.getAll([
			'organization'
		]);

		this.loading = false;
		this.smartTableSource.load(items);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	async save() {
		const dialog = this.dialogService.open(ProductTypeMutationComponent, {
			context: {
				productType: this.selectedItem
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
