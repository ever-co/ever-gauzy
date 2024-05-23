import { Routes, RouterModule } from '@angular/router';
import { PaymentsComponent } from './payments.component';
import { NgModule } from '@angular/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: PaymentsComponent,
		canActivate: [NgxPermissionsGuard],
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
		resolve: {
			dates: DateRangePickerResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PaymentsRoutingModule {}
