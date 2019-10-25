import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import {
	NbAuthComponent,
	NbLoginComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';
import { AuthGuard } from './@core/auth/auth.guard';
import { SignInSuccessComponent } from './auth/signin-success/sign-in-success.component';
import { SignInSuccessModule } from './auth/signin-success/signin-success-login-google.module';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'pages',
		loadChildren: () =>
			import('./pages/pages.module').then((m) => m.PagesModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'auth',
		component: NbAuthComponent,
		canActivate: [AppModuleGuard],
		children: [
			{
				path: '',
				component: NbLoginComponent
			},
			{
				path: 'login',
				component: NbLoginComponent
			},
			{
				path: 'register',
				component: NbRegisterComponent
			},
			{
				path: 'logout',
				component: NbLogoutComponent
			},
			{
				path: 'request-password',
				component: NbRequestPasswordComponent
			},
			{
				path: 'reset-password',
				component: NbResetPasswordComponent
			}
		]
	},
	{
		path: 'server-down',
		loadChildren: './server-down/server-down.module#ServerDownModule'
	},
	{ path: 'sign-in/success', component: SignInSuccessComponent },
	{ path: '', redirectTo: 'pages', pathMatch: 'full' },
	{ path: '**', redirectTo: 'pages' }
];

const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config), SignInSuccessModule],
	exports: [RouterModule]
})
export class AppRoutingModule {}
