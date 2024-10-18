import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { ExternalRedirectGuard, PermissionsGuard } from '@gauzy/ui-core/core';
import { ImportExportComponent } from './import-export.component';
import { ExternalRedirectComponent } from './external-redirect/external-redirect.component';

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
		component: ExternalRedirectComponent,
		canActivate: [ExternalRedirectGuard]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportExportRoutingModule {}
