import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EditProfileFormComponent } from '../../@shared/user/edit-profile-form/edit-profile-form.component';

const routes: Routes = [
	{
		path: 'profile',
		component: EditProfileFormComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AuthRoutingModule {}
