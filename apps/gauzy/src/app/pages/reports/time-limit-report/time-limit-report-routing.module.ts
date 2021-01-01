import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeLimitReportComponent } from './time-limit-report/time-limit-report.component';

const routes: Routes = [
	{
		path: '',
		component: TimeLimitReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeLimitReportRoutingModule {}
