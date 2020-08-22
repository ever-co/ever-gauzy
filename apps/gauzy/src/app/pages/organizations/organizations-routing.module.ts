import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';
import { EditOrganizationLocationComponent } from './edit-organization/edit-organization-settings/edit-organization-location/edit-organization-location.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization/edit-organization-settings/edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationMainComponent } from './edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component';

const routes: Routes = [
	{
		path: '',
		component: OrganizationsComponent
	},
	{
		path: 'edit/:id',
		component: EditOrganizationComponent,
		children: [
			{
				path: '',
				redirectTo: 'main',
				pathMatch: 'full'
			},
			{
				path: 'main',
				component: EditOrganizationMainComponent
			},
			{
				path: 'location',
				component: EditOrganizationLocationComponent
			},
			{
				path: 'settings',
				component: EditOrganizationOtherSettingsComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationsRoutingModule {}
