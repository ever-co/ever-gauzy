import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../@shared/shared.module';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { IncomeMutationModule } from '../../@shared/income/income-mutation/income-mutation.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';

@NgModule({
	imports: [
		CommonModule,
		NbBadgeModule,
		IncomeRoutingModule,
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
		PaginationV2Module,
		TableFiltersModule,
		GauzyButtonActionModule,
		SharedModule
	],
	declarations: [IncomeComponent]
})
export class IncomeModule {}
