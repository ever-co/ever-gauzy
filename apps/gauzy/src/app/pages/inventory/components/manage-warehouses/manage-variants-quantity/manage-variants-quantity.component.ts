import { Component, Input } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { InventoryStore } from '@gauzy/ui-sdk/core';
import { ManageVariantsQuantityFormComponent } from '../manage-variants-quantity-form/manage-variants-quantity-form.component';

@Component({
	selector: 'ga-manage-variants-quantity',
	templateUrl: './manage-variants-quantity.component.html',
	styleUrls: ['./manage-variants-quantity.component.scss']
})
export class ManageVariantsQuantityComponent extends TranslationBaseComponent {
	@Input() value: any;
	@Input() rowData: any;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly inventoryStore: InventoryStore
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
