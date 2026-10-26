import { Auth0Strategy, Auth0Controller } from './auth0';
import { FacebookStrategy, FacebookController } from './facebook';
import { FiverrStrategy } from './fiverr';
import { GithubStrategy, GithubController } from './github';
import { GoogleStrategy, GoogleController } from './google';
import { LinkedinStrategy, LinkedinController } from './linkedin';
import { MicrosoftStrategy, MicrosoftController, MicrosoftAuthGuard } from './microsoft';
import { TwitterStrategy, TwitterController } from './twitter';
import { OAuthAppController } from './oauth-app';

export const Strategies = [
	Auth0Strategy,
	FacebookStrategy,
	FiverrStrategy,
	GithubStrategy,
	GoogleStrategy,
	LinkedinStrategy,
	MicrosoftStrategy,
	TwitterStrategy
];

export const Controllers = [
	Auth0Controller,
	FacebookController,
	GithubController,
	GoogleController,
	LinkedinController,
	TwitterController,
	MicrosoftController,
	OAuthAppController
];

export const AuthGuards = [MicrosoftAuthGuard];
