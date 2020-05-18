import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateSpecificAvailibilityComponent } from './date-specific-availibility.component';

const routes: Routes = [
	{
		path: '',
		component: DateSpecificAvailibilityComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DateSpecificAvailibilityRouteModule {}
