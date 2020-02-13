import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
import { DangerZoneMutationComponent } from '../../@shared/settings/danger-zone-mutation/danger-zone-mutation.component';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';

const routes: Routes = [
	{
		path: '',
		component: SettingsComponent,
		children: [
			{
				path: 'general',
				component: SettingsComponent
			},
			{
				path: 'roles',
				component: EditRolesPermissionsComponent
			},
			{
				path: 'danger-zone',
				component: DangerZoneComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SettingsRoutingModule {}
