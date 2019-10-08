import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SignInSuccessComponent } from './sign-in-success.component';

const routes: Routes = [
	{
		path: 'google',
		component: SignInSuccessComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class SignInSuccessRoutingModule {}
