/**
 * Google OAuth configuration
 */
export interface IGoogleConfig {
	/** The Google OAuth App Client ID. */
	readonly clientId: string;

	/** The Google OAuth App Client Secret. */
	readonly clientSecret: string;

	/** The callback URL for Google OAuth authentication. */
	readonly callbackURL: string;
}
