import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AmountsOwedReportComponent } from './amounts-owed-report/amounts-owed-report.component';

const routes: Routes = [
	{
		path: '',
		component: AmountsOwedReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AmountsOwedReportRoutingModule {}
