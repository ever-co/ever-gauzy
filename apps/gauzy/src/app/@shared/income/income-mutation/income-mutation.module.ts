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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ContactSelectModule, CurrencyModule, SelectorsModule, TagsColorInputModule } from '@gauzy/ui-sdk/shared';
import { IncomeService, OrganizationsService } from '@gauzy/ui-sdk/core';
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
