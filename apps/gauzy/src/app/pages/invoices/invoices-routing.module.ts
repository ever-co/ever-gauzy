import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoicesComponent } from './invoices.component';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';
import { InvoicesReceivedComponent } from './invoices-received/invoices-received.component';
import { InvoiceViewComponent } from './invoice-view/invoice-view.component';
import { EstimatesComponent } from './invoice-estimates/invoice-estimates.component';
import { EstimateAddComponent } from './invoice-estimates/estimate-add/estimate-add.component';
import { EstimateEditComponent } from './invoice-estimates/estimate-edit/estimate-edit.component';
import { EstimatesReceivedComponent } from './invoice-estimates/estimates-received/estimates-received.component';
import { EstimateViewComponent } from './invoice-estimates/estimate-view/estimate-view.component';

const routes: Routes = [
	{
		path: '',
		component: InvoicesComponent,
	},
	{
		path: 'add',
		component: InvoiceAddComponent,
	},
	{
		path: 'edit/:id',
		component: InvoiceEditComponent,
	},
	{
		path: 'received-invoices',
		component: InvoicesReceivedComponent,
	},
	{
		path: 'view/:id',
		component: InvoiceViewComponent,
	},
	{
		path: 'estimates',
		component: EstimatesComponent,
	},
	{
		path: 'estimates/add',
		component: EstimateAddComponent,
	},
	{
		path: 'estimates/edit/:id',
		component: EstimateEditComponent,
	},
	{
		path: 'received-estimates',
		component: EstimatesReceivedComponent,
	},
	{
		path: 'estimates/view/:id',
		component: EstimateViewComponent,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class InvoicesRoutingModule {}
