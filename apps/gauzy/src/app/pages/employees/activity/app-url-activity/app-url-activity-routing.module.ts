import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';

const routes: Routes = [
	{
		path: '',
		component: AppUrlActivityComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AppUrlActivityRoutingModule {}
