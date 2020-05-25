import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { ContractsComponent } from './components/contracts/contracts.component';

const routes: Routes = [
	{
		path: '',
		component: UpworkAuthorizeComponent
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
				component: TransactionsComponent
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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class UpworkRoutingModule {}
