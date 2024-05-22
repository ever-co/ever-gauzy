import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { EditOrganizationMainComponent } from './edit-organization-settings/edit-organization-main/edit-organization-main.component';
import { EditOrganizationLocationComponent } from './edit-organization-settings/edit-organization-location/edit-organization-location.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-settings/edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationResolver } from './edit-organization.resolver';
import { EditOrganizationComponent } from './edit-organization.component';
import { EditOrganizationTaskSettingResolver } from './edit-organization-task-setting.resolver';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: ':id',
		component: EditOrganizationComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_EDIT],
				redirectTo
			}
		},
		resolve: {
			organization: EditOrganizationResolver,
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
