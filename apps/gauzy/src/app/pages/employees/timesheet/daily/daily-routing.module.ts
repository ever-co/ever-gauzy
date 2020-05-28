import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DailyComponent } from './daily/daily.component';

const routes: Routes = [
	{
		path: '',
		component: DailyComponent
	},
	{
		path: ':startDate',
		component: DailyComponent
	},
	{
		path: ':endDate',
		component: DailyComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DailyRoutingModule {}
