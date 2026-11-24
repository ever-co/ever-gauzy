import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { ORGANIZATION_RECURRING_EXPENSES_LIST_LINK } from './recurring-expense-record-view';
import { RecurringExpenseViewPageComponent } from './recurring-expense-view/recurring-expense-view-page.component';

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
		component: RecurringExpenseViewPageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.ORG_EXPENSES_VIEW], redirectTo: ORGANIZATION_RECURRING_EXPENSES_LIST_LINK },
			selectors: { project: false, team: false, employee: false, date: false }
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpenseRecurringRoutingModule {}
