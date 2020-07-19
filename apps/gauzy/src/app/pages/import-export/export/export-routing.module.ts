import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExportComponent } from './export.component';

const routes: Routes = [
	{
		path: '',
		component: ExportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExportRoutingModule {}
