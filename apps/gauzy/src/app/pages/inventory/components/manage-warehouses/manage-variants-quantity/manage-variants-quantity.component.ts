import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { ManageVariantsQuantityFormComponent } from '../manage-variants-quantity-form/manage-variants-quantity-form.component';
import { InventoryStore } from 'apps/gauzy/src/app/@core';
import { firstValueFrom } from 'rxjs';

@Component({
	templateUrl: './manage-variants-quantity.component.html',
	styleUrls: ['./manage-variants-quantity.component.scss']
})
export class ManageVariantsQuantityComponent
	extends TranslationBaseComponent
	implements ViewCell {
	value: any;
	rowData: any;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private inventoryStore: InventoryStore
	) {
		super(translateService);
	}

	onManageVariantsClick() {
		const dialog = this.dialogService.open(
			ManageVariantsQuantityFormComponent,
			{
				context: {
					variants: this.value
				}
			}
		);

		firstValueFrom(dialog.onClose)
			.then((res) => {
				this.inventoryStore.warehouseProductsCountUpdate$.next();
			});
	}
}
