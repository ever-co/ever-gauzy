import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { EmailTemplatesComponent } from '../email-templates/email-templates.component';
import { FileStorageComponent } from './file-storage/file-storage.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/models';
import { CustomSmtpComponent } from './custom-smtp/custom-smtp.component';

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
				path: 'email-history',
				component: EmailHistoryComponent
			},
			{
				path: 'roles',
				component: EditRolesPermissionsComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
						redirectTo: '/pages/dashboard'
					}
				}
			},
			{
				path: 'import-export',
				loadChildren: () =>
					import('../import-export/import-export.module').then(
						(m) => m.ImportExportModule
					)
			},
			{
				path: 'custom-smtp',
				component: CustomSmtpComponent
			},
			{
				path: 'file-storage',
				component: FileStorageComponent
			},
			{
				path: 'danger-zone',
				component: DangerZoneComponent
			},
			{
				path: 'email-templates',
				component: EmailTemplatesComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SettingsRoutingModule {}
