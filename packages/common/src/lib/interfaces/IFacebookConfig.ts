/**
 * Facebook OAuth configuration
 */
export interface IFacebookConfig {
	/** The Facebook OAuth App Client ID. */
	readonly clientId: string;

	/** The Facebook OAuth App Client Secret. */
	readonly clientSecret: string;

	/** The callback URL for Facebook OAuth authentication. */
	readonly callbackURL: string;
}
