import { Component, ViewChild, OnInit } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { IProductVariant } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProductVariantService } from 'apps/gauzy/src/app/@core/services/product-variant.service';
import { EnabledStatusComponent } from '../../table-components/enabled-row.component';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { ImageRowComponent } from '../../table-components/image-row.component';
import { InventoryStore } from 'apps/gauzy/src/app/@core/services/inventory-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

export interface SelectedProductVariant {
	data: IProductVariant;
	isSelected: false;
}

@UntilDestroy()
@Component({
	selector: 'ngx-variant-table',
	templateUrl: './variant-table.component.html'
})
export class VariantTableComponent
	extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('variantTable') variantTable;

	variants: IProductVariant[];

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

		this.inventoryStore.activeProduct$
			.pipe(untilDestroyed(this))
			.subscribe(async (activeProduct) => {

				let res = await this.productVariantService.getVariantsByProductId(activeProduct.id);

				this.variants = res.items;
				this.smartTableSource.load(this.variants);
			});

		this.loading = false;
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
							? variant.options
								.map((option) => option.name)
								.join(', ')
							: this.getTranslation(
								'INVENTORY_PAGE.NO_OPTIONS_LABEL'
							);
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
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (!result) return;

		try {
			const res = await this.productVariantService.delete(
				this.selectedItem.id
			);

			if (res.affected > 0) {
				this.inventoryStore.deleteVariant(this.selectedItem);

				if (this.selectedItem) {
					this.selectItem({
						isSelected: true,
						data: null
					});
				}

				this.toastrService.success(
					'INVENTORY_PAGE.PRODUCT_VARIANT_DELETED'
				);
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
