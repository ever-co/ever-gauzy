import { NgModule } from '@angular/core';
import { Routes, RouterModule, ActivatedRouteSnapshot } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { ImportComponent } from './import.component';

const routes: Routes = [
	{
		path: '',
		component: ImportComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: (route: ActivatedRouteSnapshot) => {
					const token = route.queryParamMap.get('token');
					const userId = route.queryParamMap.get('userId');
					if (token && userId) {
						return [];
					} else {
						return [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD];
					}
				},
				redirectTo: '/pages/settings'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportRoutingModule {}
