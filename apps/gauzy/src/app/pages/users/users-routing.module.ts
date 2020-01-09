import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditUserProfileComponent } from './edit-user-profile/edit-user-profile.component';
import { UsersComponent } from './users.component';
import { ManageUserInviteComponent } from './manage-user-invite/manage-user-invite.component';

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
		component: ManageUserInviteComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class UsersRoutingModule {}
