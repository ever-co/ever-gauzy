import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { IncomeComponent } from './income.component';
import { IncomeViewPageComponent } from './income-view/income-view-page.component';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: IncomeComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_INCOMES_VIEW],
				redirectTo
			}
		}
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: IncomeViewPageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.ORG_INCOMES_VIEW], redirectTo: '/pages/accounting/income' },
			selectors: { project: false, team: false, employee: false, date: false }
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IncomeRoutingModule {}
