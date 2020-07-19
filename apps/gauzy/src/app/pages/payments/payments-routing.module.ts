import { Routes, RouterModule } from '@angular/router';
import { PaymentsComponent } from './payments.component';
import { NgModule } from '@angular/core';

const routes: Routes = [
	{
		path: '',
		component: PaymentsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PaymentsRoutingModule {}
