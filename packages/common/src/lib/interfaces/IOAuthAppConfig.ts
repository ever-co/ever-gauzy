export interface IOAuthAppConfig {
	readonly clientId?: string;
	readonly clientSecret?: string;
	readonly codeSecret?: string;
	readonly redirectUris?: string[];
}
