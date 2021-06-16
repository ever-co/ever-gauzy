import { InjectionToken, NgModule } from '@angular/core';
import { Routes, RouterModule, ActivatedRouteSnapshot } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ImportExportComponent } from './import-export.component';

const externalUrlProvider = new InjectionToken('externalUrlRedirectResolver');
const routes: Routes = [
	{
		path: '',
		component: ImportExportComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.IMPORT_EXPORT_VIEW],
				redirectTo: '/pages/settings'
			}
		}
	},
	{
		path: 'export',
		loadChildren: () =>
			import('./export/export.module').then((m) => m.ExportModule)
	},
	{
		path: 'import',
		loadChildren: () =>
			import('./import/import.module').then((m) => m.ImportModule)
	},
	{
		path: 'external-redirect',
		resolve: {
			url: externalUrlProvider,
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
            useValue: (
				route: ActivatedRouteSnapshot
			) => {
                const externalUrl = route.paramMap.get('redirect');
				window.open(externalUrl, '_self');
            }
        },
    ],
})
export class ImportExportRoutingModule {}
