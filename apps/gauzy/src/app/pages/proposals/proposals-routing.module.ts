import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProposalsComponent } from './proposals.component';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';

export function redirectTo() {
	return '/pages/dashboard';
}
const PROPOSAL_VIEW_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ORG_PROPOSALS_VIEW],
		redirectTo
	}
};
const PROPOSAL_EDIT_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
		redirectTo
	}
};

const routes: Routes = [
	{
		path: '',
		component: ProposalsComponent,
		canActivate: [NgxPermissionsGuard],
		data: PROPOSAL_VIEW_PERMISSION
	},
	{
		path: 'register',
		component: ProposalRegisterComponent,
		canActivate: [NgxPermissionsGuard],
		data: PROPOSAL_EDIT_PERMISSION
	},
	{
		path: 'details/:id',
		component: ProposalDetailsComponent,
		canActivate: [NgxPermissionsGuard],
		data: PROPOSAL_VIEW_PERMISSION
	},
	{
		path: 'edit/:id',
		component: ProposalEditComponent,
		canActivate: [NgxPermissionsGuard],
		data: PROPOSAL_EDIT_PERMISSION
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProposalsRoutingModule {}
