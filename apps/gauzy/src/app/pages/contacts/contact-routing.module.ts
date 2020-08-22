import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ContactComponent } from './contact.component';
import { ClientsComponent } from './clients/clients.component';
import { LeadsComponent } from './leads/leads.component';
import { CustomersComponent } from './customers/customers.component';

const routes: Routes = [
	{
		path: '',
		component: ContactComponent
	},
	{
		path: 'clients',
		component: ClientsComponent
	},
	{
		path: 'customers',
		component: CustomersComponent
	},
	{
		path: 'leads',
		component: LeadsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ContactRoutingModule {}
