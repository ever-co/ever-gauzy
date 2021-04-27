import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { EquipmentComponent } from './equipment.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';

const routes: Routes = [
	{
		path: '',
		component: EquipmentComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [
					PermissionsEnum.ALL_ORG_VIEW,
					PermissionsEnum.ORG_EQUIPMENT_VIEW
				],
				redirectTo: '/pages/dashboard'
			},
			data: {
				selectors: {
					project: false,
					employee: false,
					date: false
				}
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentRoutingModule {}
