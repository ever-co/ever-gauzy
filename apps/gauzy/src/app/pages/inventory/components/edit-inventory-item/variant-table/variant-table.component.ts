import { Component, ViewChild, OnInit } from '@angular/core';
import { LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IProductVariant } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { EnabledStatusComponent } from '../../inventory-table-components/enabled-row.component';
import { ImageRowComponent } from '../../inventory-table-components/image-row.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InventoryStore, ProductVariantService, ToastrService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';

export interface SelectedProductVariant {
	data: IProductVariant;
	isSelected: false;
}

@UntilDestroy()
@Component({
    selector: 'ngx-variant-table',
    templateUrl: './variant-table.component.html',
    styleUrls: ['./variant-table.component.scss'],
    standalone: false
})
export class VariantTableComponent extends TranslationBaseComponent implements OnInit {
	@ViewChild('variantTable') variantTable;

	variants: IProductVariant[] = [];

	selectedItem: IProductVariant;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	loading = true;
	disableButton = true;

	constructor(
		readonly translateService: TranslateService,
		private router: Router,
		private dialogService: NbDialogService,
		private productVariantService: ProductVariantService,
		private toastrService: ToastrService,
		private inventoryStore: InventoryStore
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.loadSmartTable();

		this.inventoryStore.activeProduct$.pipe(untilDestroyed(this)).subscribe(async (activeProduct) => {
			if (activeProduct.id) {
				let res = await this.productVariantService.getVariantsByProductId(activeProduct.id);

				this.variants = res.items;
			}
			this.loading = false;
			this.smartTableSource.load(this.variants);
		});

		this._applyTranslationOnSmartTable();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				options: {
					title: this.getTranslation('INVENTORY_PAGE.OPTIONS'),
					type: 'string',
					valuePrepareFunction: (_, variant) => {
						return variant.options && variant.options.length > 0
							? variant.options.map((option) => option.name).join(', ')
							: this.getTranslation('INVENTORY_PAGE.NO_OPTIONS_LABEL');
					}
				},
				internalReference: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string'
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'string'
				},
				enabled: {
					title: this.getTranslation('INVENTORY_PAGE.ENABLED'),
					type: 'custom',
					renderComponent: EnabledStatusComponent
				}
			}
		};
	}

	onEditVariant() {
		this.router.navigate([
			`/pages/organization/inventory/${this.inventoryStore.activeProduct.id}/variants/${this.selectedItem.id}`
		]);
	}

	async selectItem({ isSelected, data }) {
		const selectedItem = isSelected ? data : null;
		if (this.variantTable) {
			this.variantTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedItem = selectedItem;
	}

	async delete() {
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose.pipe(first()));
		if (!result) return;

		try {
			const res = await this.productVariantService.delete(this.selectedItem.id);

			if (res.affected > 0) {
				this.inventoryStore.deleteVariant(this.selectedItem);

				if (this.selectedItem) {
					this.selectItem({
						isSelected: true,
						data: null
					});
				}

				this.toastrService.success('INVENTORY_PAGE.PRODUCT_VARIANT_DELETED');
			}
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
