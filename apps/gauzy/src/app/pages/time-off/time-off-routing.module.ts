import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeOffComponent } from './time-off.component';
import { TimeOffSettingsComponent } from './time-off-settings/time-off-settings.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: TimeOffComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_TIME_OFF_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		},
		runGuardsAndResolvers: 'paramsOrQueryParamsChange'
	},
	{
		path: 'settings',
		component: TimeOffSettingsComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.POLICY_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeOffRoutingModule {}
