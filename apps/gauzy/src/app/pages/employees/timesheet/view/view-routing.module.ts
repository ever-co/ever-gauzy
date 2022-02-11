import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ViewTimesheetResolver } from './view.resolver';
import { ViewComponent } from './view/view.component';

const routes: Routes = [
	{
		path: '',
		component: ViewComponent,
		resolve: { timesheet: ViewTimesheetResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ViewRoutingModule {}
