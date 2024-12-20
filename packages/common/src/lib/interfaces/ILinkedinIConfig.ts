/**
 * LinkedIn OAuth configuration
 */
export interface ILinkedinConfig {
	/** The LinkedIn OAuth App Client ID. */
	readonly clientId: string;

	/** The LinkedIn OAuth App Client Secret. */
	readonly clientSecret: string;

	/** The callback URL for LinkedIn OAuth authentication. */
	readonly callbackURL: string;
}
