import { Component, OnInit, ViewChild } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ProductMutationComponent } from '../../../@shared/product-mutation/product-mutation.component';
import { first } from 'rxjs/operators';
import { ProductService } from '../../../@core/services/product.service';
import { Product, ProductType, ProductCategory } from '@gauzy/models';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Router } from '@angular/router';
import { PictureNameTagsComponent } from '../../../@shared/table-components/picture-name-tags/picture-name-tags.component';

export interface SelectedProduct {
	data: Product;
	isSelected: false;
}

@Component({
	selector: 'ngx-inventory',
	templateUrl: './inventory.component.html',
	styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedItem: Product;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;

	@ViewChild('inventoryTable') inventoryTable;

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private productService: ProductService,
		private router: Router
	) {
		super(translateService);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string'
				},
				type: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string',
					valuePrepareFunction: (type: ProductType) => type.name
				},
				category: {
					title: this.getTranslation(
						'INVENTORY_PAGE.PRODUCT_CATEGORY'
					),
					type: 'string',
					valuePrepareFunction: (category: ProductCategory) =>
						category.name
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (description: string) => {
						return description.slice(0, 15) + '...';
					}
				}
			}
		};
	}

	manageProductTypes() {
		this.router.navigate(['/pages/organization/inventory/product-types']);
	}

	manageProductCategories() {
		this.router.navigate([
			'/pages/organization/inventory/product-categories'
		]);
	}

	async save() {
		const dialog = this.dialogService.open(ProductMutationComponent, {
			context: { product: this.selectedItem }
		});

		await dialog.onClose.pipe(first()).toPromise();

		this.loadSettings();
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.productService.delete(this.selectedItem.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.INVENTORY_ITEM_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async loadSettings() {
		this.selectedItem = null;
		const { items } = await this.productService.getAll();
		this.loading = false;
		this.smartTableSource.load(items);
	}

	async selectItem($event: SelectedProduct) {
		if ($event.isSelected) {
			this.selectedItem = $event.data;
			this.disableButton = false;
			this.inventoryTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
