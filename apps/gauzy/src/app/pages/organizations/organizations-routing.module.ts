import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';
import { EditOrganizationSettingsComponent } from './edit-organization/edit-organization-settings/edit-organization-settings.component';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';
import { EditOrganizationLocationComponent } from './edit-organization/edit-organization-settings/edit-organization-location/edit-organization-location.component';
import { EditOrganizationDepartmentsComponent } from './edit-organization/edit-organization-settings/edit-organization-departments/edit-organization-departments.component';
import { EditOrganizationClientsComponent } from './edit-organization/edit-organization-settings/edit-organization-clients/edit-organization-clients.component';
import { EditOrganizationPositionsComponent } from './edit-organization/edit-organization-settings/edit-organization-positions/edit-organization-positions.component';
import { EditOrganizationVendorsComponent } from './edit-organization/edit-organization-settings/edit-organization-vendors/edit-organization-vendors.component';
import { EditOrganizationProjectsComponent } from './edit-organization/edit-organization-settings/edit-organization-projects/edit-organization-projects.component';
import { EditOrganizationTeamsComponent } from './edit-organization/edit-organization-settings/edit-organization-teams/edit-organization-teams.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization/edit-organization-settings/edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationMainComponent } from './edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component';
import { EditOrganizationEmployeeLevelComponent } from './edit-organization/edit-organization-settings/edit-organization-employee-levels/edit-organization-employee-level.component';
import { EditOrganizationEmploymentTypes } from './edit-organization/edit-organization-settings/edit-organization-employment-types/edit-organization-employment-types.component';
import { EditOrganizationExpenseCategoriesComponent } from './edit-organization/edit-organization-settings/edit-organization-expense-categories/edit-organization-expense-categories.component';

const routes: Routes = [
	{
		path: '',
		component: OrganizationsComponent
	},
	{
		path: 'edit/:id',
		component: EditOrganizationComponent
	},
	{
		path: 'edit/:id/settings',
		component: EditOrganizationSettingsComponent,
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
				path: 'departments',
				component: EditOrganizationDepartmentsComponent
			},
			{
				path: 'clients',
				component: EditOrganizationClientsComponent
			},
			{
				path: 'positions',
				component: EditOrganizationPositionsComponent
			},
			{
				path: 'vendors',
				component: EditOrganizationVendorsComponent
			},
			{
				path: 'expense-categories',
				component: EditOrganizationExpenseCategoriesComponent
			},
			{
				path: 'projects',
				component: EditOrganizationProjectsComponent
			},
			{
				path: 'teams',
				component: EditOrganizationTeamsComponent
			},
			{
				path: 'settings',
				component: EditOrganizationOtherSettingsComponent
			},
			{
				path: 'employment-types',
				component: EditOrganizationEmploymentTypes
			},
			{
				path: 'employeeLevels',
				component: EditOrganizationEmployeeLevelComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationsRoutingModule {}
