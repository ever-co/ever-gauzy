import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ClientBudgetsReportComponent } from './client-budgets-report/client-budgets-report.component';

const routes: Routes = [
	{
		path: '',
		component: ClientBudgetsReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ClientBudgetsReportRoutingModule {}
