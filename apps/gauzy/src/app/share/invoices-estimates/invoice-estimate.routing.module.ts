import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoiceEstimateComponent } from './invoice-estimate.component';

const routes: Routes = [
	{
		path: '',
		component: InvoiceEstimateComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InvoiceEstimateRoutingModule {}
