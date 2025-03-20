/**
 * Interface defining the configuration required for Zapier OAuth integration
 */
export interface IZapierConfig {
	/** OAuth client ID provided by Zapier for application authentication */
	readonly clientId: string;

	/** OAuth client secret provided by Zapier for secure authentication */
	readonly clientSecret: string;

	/** URI where Zapier will redirect after successful OAuth authorization */
	readonly redirectUri: string;

	/** Optional URL where users will be directed after installing the Zapier integration */
	readonly postInstallUrl?: string;
}
