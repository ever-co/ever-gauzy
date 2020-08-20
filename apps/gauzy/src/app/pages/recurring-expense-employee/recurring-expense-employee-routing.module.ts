import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';

const routes: Routes = [
	{
		path: '',
		component: RecurringExpensesEmployeeComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class RecurringExpensesEmployeeRoutingModule {}
