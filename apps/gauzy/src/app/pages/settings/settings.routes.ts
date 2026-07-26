import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { SettingsComponent } from './settings.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';

/**
 * Creates the settings child routes.
 *
 * Every settings page is a CHILD of {@link SettingsComponent}, which renders the
 * `Sidebar | Settings menu | content` shell. Plugin-contributed settings pages
 * are spread in from the `settings-sections` registry location so they inherit
 * that shell too — registering a settings page at `page-sections` instead makes
 * it render standalone, without the settings menu.
 *
 * @param _pageRouteRegistryService - Service for retrieving plugin-registered routes.
 * @returns Angular Route array for the settings feature.
 */
export function createSettingsRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
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
					path: 'oauth-clients',
					loadChildren: () => import('./oauth-clients/oauth-clients.module').then((m) => m.OAuthClientsModule)
				},
				{
					path: 'file-storage',
					loadChildren: () => import('./file-storage/file-storage.module').then((m) => m.FileStorageModule)
				},
				{
					path: 'monitoring',
					loadChildren: () => import('./monitoring/monitoring.module').then((m) => m.MonitoringModule),
					canActivate: [PermissionsGuard],
					data: {
						permissions: {
							only: [PermissionsEnum.TENANT_SETTING],
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
							employee: false,
							organization: false,
							date: false
						}
					}
				},
				// Plugin-contributed settings pages (e.g. AI Providers) — rendered
				// inside the settings shell like every core settings page.
				..._pageRouteRegistryService.getPageLocationRoutes('settings-sections')
			]
		}
	];
}
