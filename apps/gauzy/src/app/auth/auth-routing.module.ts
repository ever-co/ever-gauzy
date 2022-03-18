import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxLoginComponent } from './login/login.component';
import { NgxRegisterComponent } from './register/register.component';
import { NgxAuthComponent } from "./auth/auth.component"
import { NgxForgotPasswordComponent } from "./login/forgot-password/forgot-password.component"

export const routes: Routes = [
	{
		path: 'auth',
		component: NgxAuthComponent,
		children: [
			{
				path: 'register',
				component: NgxRegisterComponent
			},
			{
				path: 'login',
				component: NgxLoginComponent
			},
			{
				path: 'request-password',
				component: NgxForgotPasswordComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class NgxAuthRoutingModule {}
