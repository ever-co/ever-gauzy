import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { AuthGuard } from '@gauzy/ui-sdk/core';
import { SignInSuccessComponent } from './auth/signin-success/sign-in-success.component';
import { SignInSuccessModule } from './auth/signin-success/signin-success-login-google.module';
import { AppModuleGuard } from './app.module.guards';
import { AcceptInviteModule } from './auth/accept-invite/accept-invite.module';
import { OnboardOrganizationClientModule } from './auth/onboard-organization-client/onboard-organization-client.module';

const routes: Routes = [
	{
		path: 'pages',
		loadChildren: () => import('./pages/pages.module').then((m) => m.PagesModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'onboarding',
		loadChildren: () => import('./onboarding/onboarding.module').then((m) => m.OnboardingModule),
		canActivate: [AuthGuard, AppModuleGuard]
	},
	{
		path: 'share',
		loadChildren: () => import('./share/share.module').then((m) => m.ShareModule),
		canActivate: []
	},
	{
		path: 'auth',
		loadChildren: () => import('./auth/auth.module').then((m) => m.NgxAuthModule),
		canActivate: []
	},
	{
		path: 'server-down',
		loadChildren: () => import('./server-down/server-down.module').then((m) => m.ServerDownModule)
	},
	{
		path: 'legal',
		loadChildren: () => import('./legal/legal.module').then((m) => m.LegalModule)
	},
	{ path: 'sign-in/success', component: SignInSuccessComponent },
	{ path: '', redirectTo: 'pages', pathMatch: 'full' },
	{ path: '**', redirectTo: 'pages' }
];

const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [
		RouterModule.forRoot(routes, config),
		SignInSuccessModule,
		AcceptInviteModule,
		OnboardOrganizationClientModule
	],
	exports: [RouterModule]
})
export class AppRoutingModule {}
