import { Component, OnInit, ViewChild } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import {
	Product,
	ProductTypeTranslated,
	ProductCategoryTranslated
} from '@gauzy/models';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from 'apps/gauzy/src/app/@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProductService } from 'apps/gauzy/src/app/@core/services/product.service';

export interface SelectedProduct {
	data: Product;
	isSelected: false;
}

@Component({
	selector: 'ngx-table-inventory',
	templateUrl: './table-inventory.component.html',
	styleUrls: ['./table-inventory.component.scss']
})
export class TableInventoryComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedItem: Product;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	selectedLanguage: string;

	@ViewChild('inventoryTable') inventoryTable;

	ngOnInit(): void {
		this.selectedLanguage = this.translateService.currentLang;
		this.translateService.onLangChange
			.pipe(take(1))
			.subscribe((languageEvent) => {
				this.selectedLanguage = languageEvent.lang;
			});

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
					valuePrepareFunction: (type: ProductTypeTranslated) =>
						type ? type.name : ''
				},
				category: {
					title: this.getTranslation(
						'INVENTORY_PAGE.PRODUCT_CATEGORY'
					),
					type: 'string',
					valuePrepareFunction: (
						category: ProductCategoryTranslated
					) => (category ? category.name : '')
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
		this.router.navigate(['/pages/organization/inventory/product-types']);
	}

	manageProductCategories() {
		this.router.navigate([
			'/pages/organization/inventory/product-categories'
		]);
	}

	onAddInventoryItem() {
		this.router.navigate([`/pages/organization/inventory/create`]);
	}

	onEditInventoryItem() {
		this.router.navigate([
			`/pages/organization/inventory/edit/${this.selectedItem.id}`
		]);
	}

	async save() {
		this.router.navigate([
			`/pages/organization/inventory/edit/${this.selectedItem.id}`
		]);

		this.loadSettings();
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (!result) return;

		try {
			const res = await this.productService.delete(this.selectedItem.id);

			if (res.affected > 0) {
				this.loadSettings();
				this.toastrService.primary(
					this.getTranslation(
						'INVENTORY_PAGE.INVENTORY_ITEM_DELETED'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		} catch {
			this.toastrService.success(
				this.getTranslation('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.disableButton = true;
		}
	}

	async loadSettings() {
		this.selectedItem = null;
		const { items } = await this.productService.getAll(
			null,
			null,
			this.selectedLanguage
		);

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
