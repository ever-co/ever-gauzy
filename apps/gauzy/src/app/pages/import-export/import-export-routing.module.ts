import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/models';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ImportExportComponent } from './import-export.component';

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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportExportRoutingModule {}
