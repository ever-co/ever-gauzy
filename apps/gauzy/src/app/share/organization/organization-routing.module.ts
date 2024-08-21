import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PublicOrganizationResolver } from '@gauzy/plugin-public-layout-ui';
import { OrganizationComponent } from './organization.component';

const routes: Routes = [
	{
		path: '',
		component: OrganizationComponent,
		data: {
			relations: ['skills', 'awards', 'languages', 'languages.language']
		},
		resolve: {
			organization: PublicOrganizationResolver
		},
		runGuardsAndResolvers: 'always'
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
