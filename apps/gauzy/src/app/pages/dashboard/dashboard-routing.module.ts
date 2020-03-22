import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';

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
				component: AccountingComponent
			},
			{
				path: 'hr',
				component: HumanResourcesComponent
			},
			{
				path: 'time-tracking',
				component: TimeTrackingComponent
			},
			{
				path: 'project-management',
				component: ProjectManagementComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DashboardRoutingModule {}
