import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { RolesPermissionsComponent } from './roles-permissions.component';

const routes: Routes = [
	{
		path: '',
		component: RolesPermissionsComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
				redirectTo: '/pages/settings'
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class RolesPermissionsRoutingModule {}
