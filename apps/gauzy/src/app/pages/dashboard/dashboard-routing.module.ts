import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { DashboardComponent } from './dashboard.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';
import { TeamComponent } from './team/team.component';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: DashboardComponent,
		children: [
			{
				path: '',
				redirectTo: 'time-tracking',
				pathMatch: 'full'
			},
			{
				path: 'accounting',
				component: AccountingComponent,
				data: {
					selectors: {
						project: false
					},
					datePicker: {
						unitOfTime: 'week'
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				},
				runGuardsAndResolvers: 'paramsOrQueryParamsChange'
			},
			{
				path: 'hr',
				component: HumanResourcesComponent,
				data: {
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
				path: 'time-tracking',
				component: TimeTrackingComponent,
				data: {
					datePicker: {
						unitOfTime: 'week'
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				},
				runGuardsAndResolvers: 'paramsOrQueryParamsChange'
			},
			{
				path: 'project-management',
				component: ProjectManagementComponent,
				data: {
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
				path: 'teams',
				component: TeamComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					datePicker: {
						unitOfTime: 'day',
						isSingleDatePicker: true,
						isLockDatePicker: true,
						isDisableFutureDate: true
					},
					selectors: {
						project: false,
						employee: true
					},
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW]
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				},
				runGuardsAndResolvers: 'paramsOrQueryParamsChange'
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DashboardRoutingModule {}
