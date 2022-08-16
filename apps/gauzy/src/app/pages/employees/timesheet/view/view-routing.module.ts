import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ViewTimesheetResolver } from './view.resolver';
import { ViewComponent } from './view/view.component';

const routes: Routes = [
	{
		path: '',
		component: ViewComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
				redirectTo: '/pages/employees/timesheets/daily'
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: false
			}
		},
		resolve: {
			timesheet: ViewTimesheetResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ViewRoutingModule {}
