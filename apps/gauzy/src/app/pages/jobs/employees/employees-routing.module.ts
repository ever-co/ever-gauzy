import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/models';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { EmployeesComponent } from './employees/employees.component';

const routes: Routes = [
	{
		path: '',
		component: EmployeesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],
				redirectTo: '/pages/jobs/search'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}
