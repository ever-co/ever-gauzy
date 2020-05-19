import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AvailabilitySlotsComponent } from './availability-slots.component';

const routes: Routes = [
	{
		path: '',
		component: AvailabilitySlotsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AvailabilitySlotsRouteModule {}
