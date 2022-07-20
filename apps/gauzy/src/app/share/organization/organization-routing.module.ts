import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationComponent } from './organization.component';
import { PublicOrganizationResolver } from './public-organization.resolver';

const routes: Routes = [
	{
		path: '',
		component: OrganizationComponent,
		runGuardsAndResolvers: 'always',
		data: {
			relations: [
				'skills',
				'awards',
				'languages',
				'languages.language'
			]
		},
		resolve: {
			organization: PublicOrganizationResolver
		}
	},
	{
		path: ':slug/:employeeId',
		loadChildren: () => import('../employee/employee.module').then((m) => m.EmployeeModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationRoutingModule {}
