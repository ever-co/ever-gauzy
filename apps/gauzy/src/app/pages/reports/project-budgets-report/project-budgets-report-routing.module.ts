import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';

const routes: Routes = [
	{
		path: '',
		component: ProjectBudgetsReportComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProjectBudgetsReportRoutingModule {}
