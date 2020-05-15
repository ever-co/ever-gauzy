import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { HelpCenterComponent } from './help-center.component';

const routes: Routes = [
	{
		path: '',
		component: HelpCenterComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class HelpCenterRoutingModule {}
