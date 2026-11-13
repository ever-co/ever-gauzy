import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbDatepickerModule,
	NbIconModule,
	NbDialogModule,
	NbSelectModule,
	NbSpinnerModule,
	NbBadgeModule,
	NbTooltipModule
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
import { IncomeViewPageComponent } from './income-view/income-view-page.component';
// The income page draws its charts with the expense page's: the same bars and ring, in the revenue colour.
import { ExpenseBarChartComponent } from '../expenses/expense-view/expense-charts/expense-bar-chart.component';
import { ExpenseShareChartComponent } from '../expenses/expense-view/expense-charts/expense-share-chart.component';

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
		NbSelectModule,
		NbTooltipModule,
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
		SharedModule,
		ExpenseBarChartComponent,
		ExpenseShareChartComponent
	],
	declarations: [IncomeComponent, IncomeViewPageComponent]
})
export class IncomeModule {}
