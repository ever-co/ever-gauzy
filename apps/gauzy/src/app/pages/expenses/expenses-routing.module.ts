import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ExpensesComponent } from './expenses.component';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { EXPENSE_RECORD_VIEW } from './expense-record-view';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: ExpensesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EXPENSES_VIEW],
				redirectTo
			}
		}
	},
	{
		path: 'categories',
		component: ExpenseCategoriesComponent,
		data: {
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.ORG_EXPENSES_VIEW], redirectTo: '/pages/accounting/expenses' },
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: EXPENSE_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpensesRoutingModule {}
