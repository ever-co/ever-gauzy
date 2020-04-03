import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoicesComponent } from './invoices.component';
import { InvoiceAddComponent } from './Invoice-add/invoice-add.component';

const routes: Routes = [
	{
		path: '',
		component: InvoicesComponent
	},
	{
		path: 'add',
		component: InvoiceAddComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoicesRoutingModule {}
