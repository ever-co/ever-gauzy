import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WorkInProgressComponent } from './work-in-progress.component';

const routes: Routes = [
	{
		path: '',
		component: WorkInProgressComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WorkInProgressRoutingModule {}
