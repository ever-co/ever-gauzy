import { Auth0Strategy, Auth0Controller } from './auth0';
import { FacebookStrategy, FacebookController } from './facebook';
import { FiverrStrategy } from './fiverr';
import { GithubStrategy, GithubController } from './github';
import { GoogleStrategy, GoogleController } from './google';
import { KeycloakStrategy, KeycloakAuthGuard } from './keycloak';
import { LinkedinStrategy, LinkedinController } from './linkedin';
import { MicrosoftStrategy, MicrosoftController, MicrosoftAuthGuard } from './microsoft';
import { TwitterStrategy, TwitterController } from './twitter';

export const Strategies = [
	Auth0Strategy,
	FacebookStrategy,
	FiverrStrategy,
	GithubStrategy,
	GoogleStrategy,
	KeycloakStrategy,
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
	MicrosoftController
];

export const AuthGuards = [MicrosoftAuthGuard, KeycloakAuthGuard];
