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
import { InvoicePaymentsComponent } from './invoice-payments/payments.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';

export function redirectTo() {
	return '/pages/dashboard';
}

const INVOICES_VIEW_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
		redirectTo
	}
};

const INVOICES_EDIT_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_EDIT],
		redirectTo
	}
};

const ESTIMATES_VIEW_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
		redirectTo
	}
};

const ESTIMATES_EDIT_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_EDIT],
		redirectTo
	}
};

const routes: Routes = [
	{
		path: '',
		component: InvoicesComponent,
		canActivate: [NgxPermissionsGuard],
		data: INVOICES_VIEW_PERMISSION
	},
	{
		path: 'add',
		component: InvoiceAddComponent,
		canActivate: [NgxPermissionsGuard],
		data: INVOICES_EDIT_PERMISSION
	},
	{
		path: 'edit/:id',
		component: InvoiceEditComponent,
		canActivate: [NgxPermissionsGuard],
		data: INVOICES_EDIT_PERMISSION
	},
	{
		path: 'received-invoices',
		component: InvoicesReceivedComponent,
		canActivate: [NgxPermissionsGuard],
		data: INVOICES_VIEW_PERMISSION
	},
	{
		path: 'view/:id',
		component: InvoiceViewComponent,
		canActivate: [NgxPermissionsGuard],
		data: INVOICES_VIEW_PERMISSION
	},
	{
		path: 'estimates',
		canActivateChild: [NgxPermissionsGuard],
		children: [
			{
				path: '',
				component: EstimatesComponent,
				data: ESTIMATES_VIEW_PERMISSION
			},
			{
				path: 'add',
				component: EstimateAddComponent,
				data: ESTIMATES_EDIT_PERMISSION
			},
			{
				path: 'edit/:id',
				component: EstimateEditComponent,
				data: ESTIMATES_EDIT_PERMISSION
			},
			{
				path: 'view/:id',
				component: EstimateViewComponent,
				data: ESTIMATES_VIEW_PERMISSION
			}
		]
	},
	{
		path: 'received-estimates',
		component: EstimatesReceivedComponent,
		canActivate: [NgxPermissionsGuard],
		data: ESTIMATES_VIEW_PERMISSION
	},
	{
		path: 'payments/:id',
		component: InvoicePaymentsComponent,
		data: INVOICES_VIEW_PERMISSION
	},
	{
		path: 'recurring',
		loadChildren: () =>
			import('./../work-in-progress/work-in-progress.module').then(
				(m) => m.WorkInProgressModule
			)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoicesRoutingModule {}
