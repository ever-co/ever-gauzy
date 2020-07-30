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

	// 		{
	// 			path: 'departments',
	// 			component: EditOrganizationDepartmentsComponent
	// 		},
	// 		{
	// 			path: 'contacts',
	// 			component: EditOrganizationContactComponent
	// 		},
	// 		{
	// 			path: 'positions',
	// 			component: EditOrganizationPositionsComponent
	// 		},
	//
	// 		{
	// 			path: 'expense-categories',
	// 			component: EditOrganizationExpenseCategoriesComponent
	// 		},
	// 		{
	// 			path: 'projects',
	// 			component: EditOrganizationProjectsComponent
	// 		},
	// 		{
	// 			path: 'teams',
	// 			component: EditOrganizationTeamsComponent
	// 		},
	// 		{
	// 			path: 'employment-types',
	// 			component: EditOrganizationEmploymentTypes
	// 		},
	// 		{
	// 			path: 'employeeLevels',
	// 			component: EditOrganizationEmployeeLevelComponent
	// 		}
	// 	]
	// }
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OrganizationsRoutingModule {}
