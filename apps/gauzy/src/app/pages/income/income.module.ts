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
import {
	CardGridModule,
	GauzyButtonActionModule,
	IncomeMutationModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule,
	TableFiltersModule,
	UserFormsModule
} from '@gauzy/ui-sdk/shared';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';

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
