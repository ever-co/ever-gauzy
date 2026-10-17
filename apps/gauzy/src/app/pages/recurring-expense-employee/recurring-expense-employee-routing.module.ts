import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { EMPLOYEE_RECURRING_EXPENSE_RECORD_VIEW } from '../expense-recurring/recurring-expense-record-view';

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
	},
	{
		// One record, full width, at a URL of its own: where the drawer's "expand to full width" icon leads.
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		data: {
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: EMPLOYEE_RECURRING_EXPENSE_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class RecurringExpensesEmployeeRoutingModule {}
