import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PublicOrganizationResolver } from '../organization/public-organization.resolver';
import { PublicEmployeeResolver } from './public-employee.resolver';
import { EmployeeComponent } from './employee.component';

const routes: Routes = [
	{
		path: '',
		component: EmployeeComponent,
		runGuardsAndResolvers: 'always',
		resolve: {
			organization: PublicOrganizationResolver,
			employee: PublicEmployeeResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeeRoutingModule {}
