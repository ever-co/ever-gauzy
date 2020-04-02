import { Routes, RouterModule } from '@angular/router';
import { TimeCalendarComponent } from './time-calendar/time-calendar.component';
import { NgModule } from '@angular/core';

const routes: Routes = [
	{
		path: '',
		component: TimeCalendarComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ResourcePlanningRoutingModule {}
