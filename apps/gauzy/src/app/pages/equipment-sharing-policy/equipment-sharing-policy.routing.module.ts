import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { EquipmentSharingPolicyComponent } from './equipment-sharing-policy.component';

const routes: Routes = [
	{
		path: '',
		component: EquipmentSharingPolicyComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentSharingPolicyRoutingModule {}
