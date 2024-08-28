import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
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

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: InvoicesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
				redirectTo
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		}
	},
	{
		path: 'add',
		component: InvoiceAddComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_EDIT],
				redirectTo
			}
		}
	},
	{
		path: 'edit/:id',
		component: InvoiceEditComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_EDIT],
				redirectTo
			}
		}
	},
	{
		path: 'received-invoices',
		component: InvoicesReceivedComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
				redirectTo
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		}
	},
	{
		path: 'view/:id',
		component: InvoiceViewComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
				redirectTo
			},
			selectors: {
				organization: false,
				date: false,
				employee: false,
				project: false,
				team: false
			}
		}
	},
	{
		path: 'estimates',
		canActivateChild: [PermissionsGuard],
		children: [
			{
				path: '',
				component: EstimatesComponent,
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
						redirectTo
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				}
			},
			{
				path: 'add',
				component: EstimateAddComponent,
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_EDIT],
						redirectTo
					},
					datePicker: {
						unitOfTime: 'month'
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				}
			},
			{
				path: 'edit/:id',
				component: EstimateEditComponent,
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_EDIT],
						redirectTo
					}
				}
			},
			{
				path: 'view/:id',
				component: EstimateViewComponent,
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
						redirectTo
					},
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false,
						team: false
					}
				}
			}
		]
	},
	{
		path: 'received-estimates',
		component: EstimatesReceivedComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
				redirectTo
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		}
	},
	{
		path: 'payments/:id',
		component: InvoicePaymentsComponent,
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
				redirectTo
			},
			selectors: {
				organization: false,
				date: false,
				employee: false,
				project: false,
				team: false
			}
		}
	},
	{
		path: 'recurring',
		loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoicesRoutingModule {}
