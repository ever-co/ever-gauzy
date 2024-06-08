import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
import { CurrencyModule } from '@gauzy/ui-sdk/shared';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { VendorSelectModule } from '../../vendor-select/vendor-select.module';
import { ExpenseCategorySelectModule } from '../expense-category-select/expense-category-select.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { ProjectSelectModule } from '../../project-select/project-select.module';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
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
		EmployeeSelectorsModule,
		NbCheckboxModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		CurrencyModule,
		VendorSelectModule,
		ExpenseCategorySelectModule,
		ContactSelectModule,
		ProjectSelectModule
	],
	exports: [ExpensesMutationComponent],
	declarations: [ExpensesMutationComponent, AttachReceiptComponent],
	providers: [OrganizationsService]
})
export class ExpensesMutationModule {}
