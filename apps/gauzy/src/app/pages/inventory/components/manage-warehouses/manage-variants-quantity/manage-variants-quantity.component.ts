import { Component, Input } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { ManageVariantsQuantityFormComponent } from '../manage-variants-quantity-form/manage-variants-quantity-form.component';
import { InventoryStore } from 'apps/gauzy/src/app/@core';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'ga-manage-variants-quantity',
	templateUrl: './manage-variants-quantity.component.html',
	styleUrls: ['./manage-variants-quantity.component.scss']
})
export class ManageVariantsQuantityComponent extends TranslationBaseComponent {
	@Input() value: any;
	@Input() rowData: any;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private inventoryStore: InventoryStore
	) {
		super(translateService);
	}

	onManageVariantsClick() {
		const dialog = this.dialogService.open(ManageVariantsQuantityFormComponent, {
			context: {
				variants: this.value
			}
		});

		firstValueFrom(dialog.onClose).then((res) => {
			this.inventoryStore.warehouseProductsCountUpdate$.next();
		});
	}
}
