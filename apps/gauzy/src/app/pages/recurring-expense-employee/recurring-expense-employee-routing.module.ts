import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-sdk/shared';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';

const routes: Routes = [
	{
		path: '',
		component: RecurringExpensesEmployeeComponent,
		data: {
			selectors: {
				project: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class RecurringExpensesEmployeeRoutingModule {}
