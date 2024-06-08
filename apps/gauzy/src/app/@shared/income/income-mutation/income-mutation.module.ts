import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbDatepickerModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CurrencyModule } from '@gauzy/ui-sdk/shared';
import { IncomeService, OrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { IncomeMutationComponent } from './income-mutation.component';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbSelectModule,
		NbCheckboxModule,
		NbTooltipModule,
		EmployeeSelectorsModule,
		I18nTranslateModule.forChild(),
		CurrencyModule,
		ContactSelectModule
	],
	declarations: [IncomeMutationComponent],
	providers: [IncomeService, OrganizationsService]
})
export class IncomeMutationModule {}
