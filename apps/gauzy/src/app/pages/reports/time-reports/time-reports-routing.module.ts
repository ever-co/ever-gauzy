import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeReportsComponent } from './time-reports/time-reports.component';

const routes: Routes = [
	{
		path: '',
		component: TimeReportsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeReportsRoutingModule {}
