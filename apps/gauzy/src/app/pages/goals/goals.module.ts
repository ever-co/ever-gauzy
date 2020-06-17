import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GoalsRoutingModule } from './goals-routing.module';
import { GoalsComponent } from './goals.component';
import {
	NbSpinnerModule,
	NbCardModule,
	NbAccordionModule,
	NbButtonModule,
	NbInputModule,
	NbDialogModule,
	NbIconModule,
	NbSelectModule,
	NbDatepickerModule,
	NbActionsModule,
	NbTabsetModule,
	NbLayoutModule,
	NbProgressBarModule,
	NbToggleModule,
	NbContextMenuModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { SharedModule } from '../../@shared/shared.module';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { KeyResultProgressChartComponent } from './keyresult-progress-chart/keyresult-progress-chart.component';
import { ChartModule } from 'angular2-chartjs';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [
		GoalsComponent,
		EditObjectiveComponent,
		EditKeyResultsComponent,
		GoalDetailsComponent,
		KeyResultDetailsComponent,
		KeyResultUpdateComponent,
		KeyResultProgressChartComponent
	],
	imports: [
		CommonModule,
		GoalsRoutingModule,
		NbSpinnerModule,
		ReactiveFormsModule,
		NbCardModule,
		NbAccordionModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSelectModule,
		NbActionsModule,
		NbDatepickerModule,
		NbTabsetModule,
		NbLayoutModule,
		NbToggleModule,
		NbProgressBarModule,
		NbContextMenuModule,
		SharedModule,
		ChartModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		EmployeeSelectorsModule,
		EmployeeMultiSelectModule
	]
})
export class GoalsModule {}
