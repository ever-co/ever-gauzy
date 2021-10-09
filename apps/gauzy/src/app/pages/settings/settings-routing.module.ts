import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { FileStorageComponent } from './file-storage/file-storage.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';
import { GeneralComponent } from './general/general.component';

const routes: Routes = [
	{
		path: '',
		component: SettingsComponent,
		children: [
			{
				path: 'general',
				component: GeneralComponent
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
					},
					selectors: {
						project: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			},
			{
				path: 'email-templates',
				loadChildren: () =>
					import('../email-templates/email-templates.module').then(
						(m) => m.EmailTemplatesModule
					)
			},
			{
				path: 'accounting-templates',
				loadChildren: () =>
					import('../accounting-templates/accounting-templates.module').then(
						(m) => m.AccountingTemplatesModule
					)
			},
			{
				path: 'roles',
				component: EditRolesPermissionsComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
						redirectTo: '/pages/settings'
					},
					selectors: {
						project: false,
						employee: false,
						date: false,
						organization: false
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
					},
					selectors: {
						project: false,
						employee: false,
						date: false,
						organization: false
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
					},
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'danger-zone',
				component: DangerZoneComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [
							PermissionsEnum.ACCESS_DELETE_ACCOUNT,
							PermissionsEnum.ACCESS_DELETE_ALL_DATA,
						],
						redirectTo: '/pages/settings'
					},
					selectors: {
						project: false,
						employee: false,
						organization: false,
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
export class SettingsRoutingModule {}
