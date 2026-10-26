import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { PaymentsComponent } from './payments.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { PAYMENT_RECORD_VIEW } from './payment-record-view';

const routes: Routes = [
	{
		path: '',
		component: PaymentsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PAYMENT_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				employee: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.ORG_PAYMENT_VIEW], redirectTo: '/pages/accounting/payments' },
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: PAYMENT_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PaymentsRoutingModule {}
