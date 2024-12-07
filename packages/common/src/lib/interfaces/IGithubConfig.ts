
/**
 * GitHub OAuth configuration
 */
export interface IGithubConfig {
	/** The GitHub OAuth App Client ID. */
	readonly clientId: string;

	/** The GitHub OAuth App Client Secret. */
	readonly clientSecret: string;

	/** The callback URL for GitHub OAuth authentication. */
	readonly callbackURL: string;

	/** The User Agent string for GitHub API requests. * */
	readonly userAgent: string;
}

/**
 * Configuration options for GitHub integration.
 */
export interface IGithubIntegrationConfig {

	/** The GitHub App Client ID. */
	readonly clientId: string;

	/** The GitHub App Client Secret. */
	readonly clientSecret: string;

	/** The GitHub App ID. */
	readonly appId: string;

	/** The name of the GitHub App. */
	readonly appName: string;

	/** The private key associated with the GitHub App. */
	readonly appPrivateKey: string;

	/** The URL to redirect to after GitHub App installation. */
	readonly postInstallUrl: string;

	/** The URL for receiving GitHub webhooks. */
	readonly webhookUrl: string;

	/** The secret used to secure GitHub webhooks. */
	readonly webhookSecret: string;
}
