import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';

const routes: Routes = [
	{
		path: '',
		component: SettingsComponent,
		children: [
			{
				path: 'general',
				loadChildren: () =>
					import('./general-setting/general-setting.module').then((m) => m.GeneralSettingModule)
			},
			{
				path: 'features',
				loadChildren: () => import('./feature/feature.module').then((m) => m.FeatureModule)
			},
			{
				path: 'email-history',
				component: EmailHistoryComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.VIEW_ALL_EMAILS],
						redirectTo: '/pages/settings'
					},
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			},
			{
				path: 'email-templates',
				loadChildren: () =>
					import('../email-templates/email-templates.module').then((m) => m.EmailTemplatesModule)
			},
			{
				path: 'accounting-templates',
				loadChildren: () =>
					import('../accounting-templates/accounting-templates.module').then(
						(m) => m.AccountingTemplatesModule
					)
			},
			{
				path: 'roles-permissions',
				loadChildren: () =>
					import('./roles-permissions/roles-permissions.module').then((m) => m.RolesPermissionsModule)
			},
			{
				path: 'import-export',
				loadChildren: () => import('../import-export/import-export.module').then((m) => m.ImportExportModule),
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			},
			{
				path: 'sms-gateway',
				component: SmsGatewayComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.SMS_GATEWAY_VIEW],
						redirectTo: '/pages/settings'
					},
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			},
			{
				path: 'custom-smtp',
				loadChildren: () => import('./custom-smtp/custom-smtp.module').then((m) => m.CustomSmtpModule)
			},
			{
				path: 'file-storage',
				loadChildren: () => import('./file-storage/file-storage.module').then((m) => m.FileStorageModule)
			},
			{
				path: 'danger-zone',
				component: DangerZoneComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA],
						redirectTo: '/pages/settings'
					},
					selectors: {
						project: false,
						team: false,
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
