import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { OrganizationsComponent } from './organizations.component';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: OrganizationsComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW],
				redirectTo
			},
			selectors: {
				project: false,
				team: false,
				employee: false,
				organization: false,
				date: false
			}
		}
	},
	{
		path: 'edit',
		loadChildren: () => import('./edit-organization/edit-organization.module').then((m) => m.EditOrganizationModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationsRoutingModule {}
