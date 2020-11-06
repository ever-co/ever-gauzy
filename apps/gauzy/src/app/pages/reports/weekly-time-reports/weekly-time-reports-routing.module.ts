import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';

const routes: Routes = [
	{
		path: '',
		component: WeeklyTimeReportsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyTimeReportsRoutingModule {}
