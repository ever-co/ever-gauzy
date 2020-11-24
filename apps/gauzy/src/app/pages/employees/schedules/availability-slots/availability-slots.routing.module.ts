import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AvailabilitySlotsComponent } from './availability-slots.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'recurring-availability',
		pathMatch: 'full'
	},
	{
		path: 'date-specific-availability',
		data: {
			page: 'date-specific'
		},
		component: AvailabilitySlotsComponent
	},
	{
		path: 'recurring-availability',
		data: {
			page: 'recurring'
		},
		component: AvailabilitySlotsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AvailabilitySlotsRouteModule {}
