import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProposalsComponent } from './proposals.component';
import { ProposalRegisterComponent } from './register/proposal-register.component';

const routes: Routes = [
	{
		path: '',
		component: ProposalsComponent
	},
	{
		path: 'register',
		component: ProposalRegisterComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProposalsRoutingModule {}
