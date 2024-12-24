/**
 * Configuration options for Upwork integration.
 */
export interface IUpworkConfig {
	/** The Upwork API Key. */
	readonly apiKey: string;

	/** The Upwork API Secret. */
	readonly apiSecret: string;

	/** The callback URL for Upwork OAuth authentication. */
	readonly callbackUrl: string;

	/** The URL to redirect to after Upwork App installation. */
	readonly postInstallUrl: string;
}
