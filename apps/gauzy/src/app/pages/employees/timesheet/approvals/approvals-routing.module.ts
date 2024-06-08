import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { DateRangePickerResolver } from './../../../../@theme/components/header/selectors/date-range-picker';
import { ApprovalsComponent } from './approvals/approvals.component';

const routes: Routes = [
	{
		path: '',
		component: ApprovalsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
				redirectTo: '/pages/employees/timesheets/daily'
			},
			selectors: {
				project: false,
				team: false
			},
			datePicker: {
				unitOfTime: 'month',
				isLockDatePicker: true,
				isSaveDatePicker: true
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
export class ApprovalsRoutingModule {}
