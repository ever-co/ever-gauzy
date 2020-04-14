import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoicesComponent } from './invoices.component';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';

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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoicesRoutingModule {}
