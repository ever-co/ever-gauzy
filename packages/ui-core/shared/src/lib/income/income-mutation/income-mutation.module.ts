import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { IncomeService, OrganizationsService } from '@gauzy/ui-core/core';
import { SelectorsModule } from '../../selectors/selectors.module';
import { CurrencyModule } from '../../modules/currency/currency.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { IncomeMutationComponent } from './income-mutation.component';

@NgModule({
	imports: [
		CommonModule,
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
		I18nTranslateModule.forChild(),
		SelectorsModule,
		CurrencyModule,
		ContactSelectModule,
		TagsColorInputModule
	],
	declarations: [IncomeMutationComponent],
	providers: [IncomeService, OrganizationsService]
})
export class IncomeMutationModule {}
