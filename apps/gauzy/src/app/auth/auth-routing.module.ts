import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxLoginComponent } from './login/login.component';
import { NgxRegisterComponent } from './register/register.component';
import { NgxAuthComponent } from "./auth/auth.component"

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
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class NgxAuthRoutingModule {}
