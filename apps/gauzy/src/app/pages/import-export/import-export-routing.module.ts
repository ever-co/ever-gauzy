import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExportComponent } from './export/export.component';
import { ImportExportComponent } from './import-export.component';
import { ImportComponent } from './import/import.component';

const routes: Routes = [
	{
		path: '',
		component: ImportExportComponent
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
