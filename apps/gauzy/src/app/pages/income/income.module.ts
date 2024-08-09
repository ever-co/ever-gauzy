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
import { TranslateModule } from '@ngx-translate/core';
import {
	AngularSmartTableModule,
	CardGridModule,
	IncomeMutationModule,
	SharedModule,
	TableComponentsModule,
	TableFiltersModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
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
		NgSelectModule,
		NbDialogModule.forChild(),
		UserFormsModule,
		IncomeMutationModule,
		TableComponentsModule,
		CardGridModule,
		TranslateModule.forChild(),
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		AngularSmartTableModule,
		TableFiltersModule,
		SharedModule
	],
	declarations: [IncomeComponent]
})
export class IncomeModule {}
