import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DownloadsComponent } from './downloads.component';

const routes: Routes = [
	{
		path: '',
		component: DownloadsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DownloadsRoutingModule {}
