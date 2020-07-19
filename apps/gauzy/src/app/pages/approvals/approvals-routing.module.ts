import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ApprovalsComponent } from './approvals.component';

const routes: Routes = [
	{
		path: '',
		component: ApprovalsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ApprovalsRoutingModule {}
