import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoicesComponent } from './invoices.component';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';
import { InvoicesRecievedComponent } from './invoices-recieved/invoices-recieved.component';
import { InvoiceViewComponent } from './invoice-view/invoice-view.component';

const routes: Routes = [
	{
		path: '',
		component: InvoicesComponent
	},
	{
		path: 'add',
		component: InvoiceAddComponent
	},
	{
		path: 'edit/:id',
		component: InvoiceEditComponent
	},
	{
		path: 'recieved-invoices',
		component: InvoicesRecievedComponent
	},
	{
		path: 'view/:id',
		component: InvoiceViewComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoicesRoutingModule {}
