import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeAndActivitiesComponent } from './time-and-activities/time-and-activities.component';

const routes: Routes = [
	{
		path: '',
		component: TimeAndActivitiesComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeAndActivitiesRoutingModule {}
