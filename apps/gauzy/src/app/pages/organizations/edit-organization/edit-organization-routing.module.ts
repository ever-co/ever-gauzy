import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { EditOrganizationMainComponent } from './edit-organization-settings/edit-organization-main/edit-organization-main.component';
import { EditOrganizationLocationComponent } from './edit-organization-settings/edit-organization-location/edit-organization-location.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-settings/edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationComponent } from './edit-organization.component';
import { EditOrganizationTaskSettingResolver } from './edit-organization-task-setting.resolver';
import { OrganizationResolver } from '../organization.resolver';

export function redirectTo() {
	return '/pages/dashboard';
}

export const routes: Routes = [
	{
		path: ':id',
		component: EditOrganizationComponent,
		canActivate: [PermissionsGuard],
		data: {
			// The tabset identifier for the route, read by `EditOrganizationSettingsComponent`
			// and handed to `gz-dynamic-tabs` — the same wiring the employee edit page uses.
			tabsetId: 'organization-edit-page',
			permissions: {
				only: [PermissionsEnum.ALL_ORG_EDIT],
				redirectTo
			}
		},
		resolve: {
			organization: OrganizationResolver,
			organizationTaskSetting: EditOrganizationTaskSettingResolver
		},
		runGuardsAndResolvers: 'always',
		children: [
			{
				path: '',
				redirectTo: 'main',
				pathMatch: 'full'
			},
			{
				path: 'main',
				component: EditOrganizationMainComponent,
				data: {
					relations: ['tags'],
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'location',
				component: EditOrganizationLocationComponent,
				data: {
					relations: ['contact'],
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'settings',
				component: EditOrganizationOtherSettingsComponent,
				data: {
					relations: ['accountingTemplates'],
					// The contact holds the organization's country, which the EEA/UK checks on this page read
					// (agent exit/logout #9873, screen capture acknowledgement #9872), as the API does. The API
					// answers it only with ORG_CONTACT_VIEW, while the page is every organization editor's: without
					// that permission the page opens without the contact and judges the location by its region code
					// and time zone, and the API still checks the country when the settings are saved.
					permittedRelations: { contact: PermissionsEnum.ORG_CONTACT_VIEW },
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EditOrganizationRoutingModule {}
