import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';

const routes: Routes = [
	{
		path: '',
		component: AppsUrlsReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AppsUrlsReportRoutingModule {}
