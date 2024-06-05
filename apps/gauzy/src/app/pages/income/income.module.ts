import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbDatepickerModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbBadgeModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { IncomeService } from '@gauzy/ui-sdk/core';
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { ThemeModule } from '../../@theme/theme.module';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { IncomeMutationModule } from '../../@shared/income/income-mutation/income-mutation.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';

@NgModule({
	imports: [
		NbBadgeModule,
		IncomeRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbDatepickerModule,
		NbIconModule,
		Angular2SmartTableModule,
		NgSelectModule,
		NbDialogModule.forChild(),
		UserFormsModule,
		IncomeMutationModule,
		TableComponentsModule,
		CardGridModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		PaginationV2Module,
		TableFiltersModule,
		GauzyButtonActionModule,
		DirectivesModule
	],
	declarations: [IncomeComponent],
	providers: [IncomeService]
})
export class IncomeModule {}
