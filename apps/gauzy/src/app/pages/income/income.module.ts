import { NgModule } from '@angular/core';
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
	SmartDataViewLayoutModule,
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
		NbBadgeModule,
		IncomeRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbDatepickerModule,
		NbIconModule,
		NgSelectModule,
		NbDialogModule.forChild(),
		UserFormsModule,
		IncomeMutationModule,
		TableComponentsModule,
		TranslateModule.forChild(),
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TableFiltersModule,
		SharedModule
	],
	declarations: [IncomeComponent]
})
export class IncomeModule {}
