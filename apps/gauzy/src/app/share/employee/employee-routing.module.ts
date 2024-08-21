import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PublicEmployeeResolver, PublicOrganizationResolver } from '@gauzy/plugin-public-layout-ui';
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
