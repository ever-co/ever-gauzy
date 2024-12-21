import { Component, ViewChild, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Angular2SmartTableComponent } from 'angular2-smart-table';
import { IWarehouseProductVariant } from '@gauzy/contracts';
import { ImageRowComponent } from '../../inventory-table-components/image-row.component';
import { ManageQuantityComponent } from '../manage-quantity/manage-quantity.component';

@Component({
    templateUrl: './manage-variants-quantity-form.component.html',
    styleUrls: ['./manage-variants-quantity-form.component.scss'],
    standalone: false
})
export class ManageVariantsQuantityFormComponent extends TranslationBaseComponent implements OnInit {
	variants: IWarehouseProductVariant[] = [];
	variantsTable: any[] = [];

	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	warehouseVariantsTable: Angular2SmartTableComponent;

	@ViewChild('warehouseVariantsTable') set content(content: Angular2SmartTableComponent) {
		if (content) {
			this.warehouseVariantsTable = content;
		}
	}

	constructor(public dialogRef: NbDialogRef<any>, readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSmartTable();

		new Promise((res) => {
			res(
				this.variants
					.map((variant) => {
						return {
							id: variant.id,
							image: variant.variant.image,
							options: variant.variant.options.map((opt) => opt.name).join(', '),
							quantity: variant.quantity,
							type: 'variant'
						};
					})
					.slice()
			);
		}).then((res) => {
			this.variantsTable = res as any;
			this.smartTableSource.load(this.variantsTable);
		});
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
					type: 'string'
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'custom',
					renderComponent: ManageQuantityComponent
				}
			}
		};
	}

	onClose() {
		this.dialogRef.close();
	}
}
