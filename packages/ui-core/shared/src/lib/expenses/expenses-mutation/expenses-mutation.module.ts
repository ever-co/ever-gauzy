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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { OrganizationsService } from '@gauzy/ui-core/core';
import { VendorSelectModule } from '../../vendor-select/vendor-select.module';
import { ExpenseCategorySelectModule } from '../expense-category-select/expense-category-select.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { CurrencyModule } from '../../modules/currency/currency.module';
import { SelectorsModule } from '../../selectors/selectors.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbInputModule,
		FormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NbRadioModule,
		NbCheckboxModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		ImageUploaderModule,
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
