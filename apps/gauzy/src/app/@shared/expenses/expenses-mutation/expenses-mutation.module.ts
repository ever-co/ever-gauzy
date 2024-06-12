import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbRadioModule,
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import {
	ContactSelectModule,
	CurrencyModule,
	ImageUploaderModule,
	SelectorsModule,
	TagsColorInputModule
} from '@gauzy/ui-sdk/shared';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { VendorSelectModule } from '../../vendor-select/vendor-select.module';
import { ExpenseCategorySelectModule } from '../expense-category-select/expense-category-select.module';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		ImageUploaderModule,
		ReactiveFormsModule,
		NbInputModule,
		FormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NbRadioModule,
		NbCheckboxModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		CurrencyModule,
		VendorSelectModule,
		ExpenseCategorySelectModule,
		ContactSelectModule,
		SelectorsModule,
		TagsColorInputModule
	],
	exports: [ExpensesMutationComponent],
	declarations: [ExpensesMutationComponent, AttachReceiptComponent],
	providers: [OrganizationsService]
})
export class ExpensesMutationModule {}
