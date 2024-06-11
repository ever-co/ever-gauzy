import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PaymentsComponent } from './payments.component';
import { DateRangePickerResolver } from '../../@shared/selectors/date-range-picker';

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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PaymentsRoutingModule {}
