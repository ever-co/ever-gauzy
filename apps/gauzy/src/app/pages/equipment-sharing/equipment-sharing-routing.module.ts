import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { EquipmentSharingComponent } from './equipment-sharing.component';

const routes: Routes = [
	{
		path: '',
		component: EquipmentSharingComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentSharingRoutingModule {}
