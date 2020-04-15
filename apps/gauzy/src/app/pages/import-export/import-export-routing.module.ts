import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ImportExportComponent } from './import-export.component';

const routes: Routes = [
	{
		path: '',
		component: ImportExportComponent,
		children: [
			{
				path: 'export',
				loadChildren: () =>
					import('./export/export.module').then((m) => m.ExportModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportExportRoutingModule {}
