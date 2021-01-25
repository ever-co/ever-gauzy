import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { EmailTemplatesComponent } from '../email-templates/email-templates.component';
import { FileStorageComponent } from './file-storage/file-storage.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';

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
				path: 'features',
				loadChildren: () =>
					import('./feature/feature.module').then(
						(m) => m.FeatureModule
					)
			},
			{
				path: 'email-history',
				component: EmailHistoryComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.VIEW_ALL_EMAILS],
						redirectTo: '/pages/settings'
					}
				}
			},
			{
				path: 'email-templates',
				component: EmailTemplatesComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES],
						redirectTo: '/pages/settings'
					}
				}
			},
			{
				path: 'roles',
				component: EditRolesPermissionsComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
						redirectTo: '/pages/settings'
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
				path: 'sms-gateway',
				component: SmsGatewayComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.SMS_GATEWAY_VIEW],
						redirectTo: '/pages/settings'
					}
				}
			},
			{
				path: 'custom-smtp',
				loadChildren: () =>
					import('./custom-smtp/custom-smtp.module').then(
						(m) => m.CustomSmtpModule
					)
			},
			{
				path: 'file-storage',
				component: FileStorageComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.FILE_STORAGE_VIEW],
						redirectTo: '/pages/settings'
					}
				}
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
