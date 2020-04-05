import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CandidatesComponent } from './candidates.component';
import { ManageCandidateInviteComponent } from './manage-candidate-invite/manage-candidate-invite.component';
import { InviteGuard } from '../../@core/role/invite.guard';
import { PermissionsEnum } from '@gauzy/models';

const routes: Routes = [
	{
		path: '',
		component: CandidatesComponent
	},
	{
		path: 'invites',
		component: ManageCandidateInviteComponent,
		canActivate: [InviteGuard],
		data: {
			expectedPermissions: [
				PermissionsEnum.ORG_INVITE_EDIT,
				PermissionsEnum.ORG_INVITE_VIEW
			]
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class CandidatesRoutingModule {}
