import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { ContractsComponent } from './components/contracts/contracts.component';
import { ReportsComponent } from './components/reports/reports.component';
import { IntegrationUpworkLayoutComponent } from './integration-upwork.layout.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationUpworkLayoutComponent,
				children: [
					{
						path: '',
						component: UpworkAuthorizeComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: UpworkAuthorizeComponent,
						data: { state: false }
					},
					{
						path: ':id',
						component: UpworkComponent,
						children: [
							{
								path: '',
								redirectTo: 'contracts',
								pathMatch: 'full'
							},
							{
								path: 'activities',
								component: TransactionsComponent
							},
							{
								path: 'reports',
								component: ReportsComponent,
								data: { selectors: { project: false } }
							},
							{
								path: 'transactions',
								component: TransactionsComponent
							},
							{
								path: 'contracts',
								component: ContractsComponent
							}
						]
					},
					{
						path: ':id/settings',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationUpworkRoutes {}
