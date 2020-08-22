import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExpenseRecurringComponent } from './expense-recurring.component';

const routes: Routes = [
	{
		path: '',
		component: ExpenseRecurringComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpenseRecurringRoutingModule {}
