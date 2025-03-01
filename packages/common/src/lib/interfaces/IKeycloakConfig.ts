export interface IKeycloakConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly realm: string;
	readonly authServerUrl: string;
	readonly cookieKey: string;
}
