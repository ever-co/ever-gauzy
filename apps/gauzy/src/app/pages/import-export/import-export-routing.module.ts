import { InjectionToken, NgModule } from '@angular/core';
import { Routes, RouterModule, ActivatedRouteSnapshot } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { ImportExportComponent } from './import-export.component';

const externalUrlProvider = new InjectionToken('externalUrlRedirectResolver');

const routes: Routes = [
	{
		path: '',
		component: ImportExportComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD, PermissionsEnum.EXPORT_ADD],
				redirectTo: '/pages/settings'
			}
		}
	},
	{
		path: 'export',
		loadChildren: () => import('./export/export.module').then((m) => m.ExportModule)
	},
	{
		path: 'import',
		loadChildren: () => import('./import/import.module').then((m) => m.ImportModule)
	},
	{
		path: 'external-redirect',
		resolve: {
			url: externalUrlProvider
		},
		canActivate: [externalUrlProvider]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
	providers: [
		{
			provide: externalUrlProvider,
			useValue: (route: ActivatedRouteSnapshot) => {
				const externalUrl = route.paramMap.get('redirect');
				window.open(externalUrl, '_blank');
			}
		}
	]
})
export class ImportExportRoutingModule {}
