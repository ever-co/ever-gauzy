import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';

const routes: Routes = [
	{
		path: '',
		component: ProjectBudgetsReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProjectBudgetsReportRoutingModule {}
