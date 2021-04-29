import { Component, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { ManageVariantsQuantityFormComponent } from '../manage-variants-quantity-form/manage-variants-quantity-form.component';

@Component({
	templateUrl: './manage-variants-quantity.component.html',
	styleUrls: ['./manage-variants-quantity.component.scss']
})
export class ManageVariantsQuantityComponent
	extends TranslationBaseComponent
	implements ViewCell, OnInit {
	value: any;
	rowData: any;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit() {
		//tstodo
		console.log(this.rowData, 'row data');
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
	}
}
