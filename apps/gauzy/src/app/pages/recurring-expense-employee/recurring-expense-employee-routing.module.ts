import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { DateRangePickerResolver } from '../../@shared/selectors/date-range-picker';

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
