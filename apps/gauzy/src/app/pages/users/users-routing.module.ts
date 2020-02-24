import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditUserProfileComponent } from './edit-user-profile/edit-user-profile.component';
import { UsersComponent } from './users.component';
import { ManageUserInviteComponent } from './manage-user-invite/manage-user-invite.component';
import { InviteGuard } from '../../@core/role/invite.guard';
import { PermissionsEnum } from '@gauzy/models';

const routes: Routes = [
	{
		path: '',
		component: UsersComponent
	},
	{
		path: 'edit/:id',
		component: EditUserProfileComponent
	},
	{
		path: 'invites',
		component: ManageUserInviteComponent,
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
export class UsersRoutingModule {}
