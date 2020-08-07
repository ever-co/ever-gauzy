import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationComponent } from './organization.component';

const routes: Routes = [
	{
		path: '',
		component: OrganizationComponent
	},
	{
		path: ':employeeId',
		loadChildren: () =>
			import('../employee/employee.module').then((m) => m.EmployeeModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationRoutingModule {}
