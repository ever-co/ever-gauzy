import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';

const routes: Routes = [
	{
		path: '',
		component: ExpensesReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpensesReportRoutingModule {}
