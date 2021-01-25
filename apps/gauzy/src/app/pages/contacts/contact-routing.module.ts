import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ContactComponent } from './contact.component';
import { ClientsComponent } from './clients/clients.component';
import { LeadsComponent } from './leads/leads.component';
import { CustomersComponent } from './customers/customers.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';

const CONTACT_VIEW_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW],
		redirectTo: '/pages/contacts/visitors'
	}
};

const routes: Routes = [
	{
		path: '',
		component: ContactComponent
	},
	{
		path: 'clients',
		component: ClientsComponent,
		canActivate: [NgxPermissionsGuard],
		data: CONTACT_VIEW_PERMISSION
	},
	{
		path: 'customers',
		component: CustomersComponent,
		canActivate: [NgxPermissionsGuard],
		data: CONTACT_VIEW_PERMISSION
	},
	{
		path: 'leads',
		component: LeadsComponent,
		canActivate: [NgxPermissionsGuard],
		data: CONTACT_VIEW_PERMISSION
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ContactRoutingModule {}
