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
		path: 'externalRedirect',
		resolve: {
			url: externalUrlProvider,
		}, // We need a component here because we cannot define the route otherwise
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
                const redirect = route.paramMap.get('redirect');
                let queryParams = route.queryParams;
                // Initialize Params Object
                let url = [redirect];
                if (Object.keys(queryParams).length > 0){
                    let myQuery = '';
                    for (let key in queryParams) {
                        myQuery += key + '=' + encodeURIComponent(queryParams[key]) + '&';
                    }
                    myQuery = myQuery.substring(0, myQuery.length - 1);
                    url.push(myQuery);
                }

                let externalUrl = url.join('?');
                window.open(externalUrl, '_self');
            }
        },
    ],
})
export class ImportExportRoutingModule {}
