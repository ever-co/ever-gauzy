import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AllReportComponent } from './all-report/all-report.component';

const routes: Routes = [
	{
		path: '',
		component: AllReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AllReportRoutingModule {}
