export interface IGithubConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly code: string;
	readonly redirectUri?: string;
	readonly state: string;
}
