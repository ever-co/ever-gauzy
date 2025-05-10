export interface IKeycloakConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly realm: string;
	readonly authServerURL: string;
	readonly cookieKey: string;
	readonly callbackURL: string;
}
