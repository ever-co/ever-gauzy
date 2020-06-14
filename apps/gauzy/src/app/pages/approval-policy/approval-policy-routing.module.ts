import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ApprovalPolicyComponent } from './approval-policy.component';

const routes: Routes = [
	{
		path: '',
		component: ApprovalPolicyComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ApprovalPolicyRoutingModule {}
