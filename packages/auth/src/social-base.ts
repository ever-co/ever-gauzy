import {
	Auth0Controller,
	FacebookController,
	GithubController,
	GoogleController,
	LinkedinController,
	MicrosoftController,
	TwitterController
} from './controllers';

export interface ISocialController<SocialAuthService>
	extends Auth0Controller<SocialAuthService>,
		FacebookController<SocialAuthService>,
		GithubController<SocialAuthService>,
		GoogleController<SocialAuthService>,
		LinkedinController<SocialAuthService>,
		MicrosoftController<SocialAuthService>,
		FacebookController<SocialAuthService>,
		TwitterController<SocialAuthService> {
	auth0Login?(): any;

	auth0LoginCallback?(args: any, res: any): any;

	facebookLogin?(): any;

	facebookLoginCallback?(args: any, res: any): any;

	twitterLogin?(): any;

	twitterLoginCallback?(args: any, res: any): any;

	githubLogin?(ctx: any): any;

	githubLoginCallback?(ctx: any, res: any): any;

	googleLogin?(): any;

	googleLoginCallback?(ctx: any, res: any): any;

	linkedinLogin?(): any;

	linkedinLoginCallback?(args: any, res: any): any;

	microsoftLogin?(): any;

	microsoftLoginCallback?(args: any, res: any): any;
}
