import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ManualTimeComponent } from './manual-time/manual-time.component';

const routes: Routes = [
	{
		path: '',
		component: ManualTimeComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ManualTimeRoutingModule {}
