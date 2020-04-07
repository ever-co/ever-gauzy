import { Component, OnInit, ViewChild } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { InventoryItem, Inventory } from '@gauzy/models';
import { ProductMutationComponent } from '../../../@shared/product-mutation/product-mutation.component';

@Component({
	selector: 'ngx-inventory',
	templateUrl: './inventory.component.html',
	styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedItem: InventoryItem;
	inventory: Inventory;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;

	@ViewChild('inventoryTable', { static: false }) inventoryTable;

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
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
					type: 'string'
				},
				productType: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string'
				},
				productCategory: {
					title: this.getTranslation(
						'INVENTORY_PAGE.PRODUCT_CATEGORY'
					),
					type: 'string'
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false
				},
				unitCost: {
					title: this.getTranslation('INVENTORY_PAGE.UNIT_COST'),
					type: 'number',
					filter: false
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'number',
					filter: false
				}
			}
		};
	}

	async save() {
		const dialog = this.dialogService.open(ProductMutationComponent, {
			context: { productItem: this.selectedItem }
		});
	}

	async delete() {}

	async loadSettings() {
		this.selectedItem = null;
		// const { items } = await this.inventoryService.getAll();
		const items = [];
		this.loading = false;
		this.smartTableSource.load(items);
	}

	//todo
	async selectItem($event: any) {
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
