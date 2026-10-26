import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { ORGANIZATION_RECURRING_EXPENSE_RECORD_VIEW } from './recurring-expense-record-view';

const routes: Routes = [
	{
		path: '',
		component: ExpenseRecurringComponent,
		data: {
			selectors: {
				project: false,
				employee: false
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
			recordView: ORGANIZATION_RECURRING_EXPENSE_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpenseRecurringRoutingModule {}
