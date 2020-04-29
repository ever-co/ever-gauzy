import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WeeklyComponent } from './weekly/weekly.component';

const routes: Routes = [
	{
		path: '',
		component: WeeklyComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyRoutingModule {}
