export interface IGithubConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly callbackUrl?: string;
}

export interface IGitHubIntegrationConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly appId: string;
	readonly privateKey: string;
	readonly webhookSecret: string;
}
