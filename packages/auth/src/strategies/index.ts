import { Auth0Strategy } from './auth0.strategy';
import { FacebookStrategy } from './facebook.strategy';
import { FiverrStrategy } from './fiverr.strategy';
import { GithubStrategy } from './github.strategy';
import { GoogleStrategy } from './google.strategy';
import { KeycloakStrategy } from './keycloak.strategy';
import { LinkedinStrategy } from './linkedin.strategy';
import { MicrosoftStrategy } from './microsoft.strategy';
import { TwitterStrategy } from './twitter.strategy';

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
