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
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	IncomeMutationModule,
	RecordViewModule,
	SharedModule,
	TableComponentsModule,
	TableFiltersModule,
	UserFormsModule,
	FavoriteToggleModule
} from '@gauzy/ui-core/shared';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';

@NgModule({
	imports: [
		FavoriteToggleModule,
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
		RecordViewModule,
		TableComponentsModule,
		CardGridModule,
		TranslatePipe,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TableFiltersModule,
		SharedModule
	],
	declarations: [IncomeComponent]
})
export class IncomeModule {}
