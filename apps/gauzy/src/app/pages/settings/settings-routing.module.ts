import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
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
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SettingsRoutingModule {}
