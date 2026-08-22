import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BillingComponent } from './billing.component';

const routes: Routes = [
	{
		path: '',
		component: BillingComponent,
		data: {
			// Billing is a tenant-wide concern, not scoped to an organization or a date range.
			selectors: false
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class BillingRoutingModule {}
