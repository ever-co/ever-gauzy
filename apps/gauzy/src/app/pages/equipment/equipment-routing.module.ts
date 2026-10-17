import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { EquipmentComponent } from './equipment.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { EQUIPMENT_RECORD_VIEW } from './equipment-record-view';

const routes: Routes = [
	{
		path: '',
		component: EquipmentComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_VIEW],
				redirectTo: '/pages/organization/equipment'
			},
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: EQUIPMENT_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentRoutingModule {}
