import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: DashboardComponent,
		children: [
			{
				path: '',
				redirectTo: 'accounting',
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
						unitOfTime: 'month'
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				}
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
				}
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
				}
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
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DashboardRoutingModule {}
