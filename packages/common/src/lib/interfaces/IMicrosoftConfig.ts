/**
 * Microsoft OAuth configuration
 */
export interface IMicrosoftConfig {
	/** The URL for the Microsoft Graph API. */
	readonly graphApiURL: string;

	/** The URL for Microsoft OAuth authorization. */
	readonly authorizationURL: string;

	/** The URL for Microsoft OAuth token retrieval. */
	readonly tokenURL: string;

	/** The Microsoft OAuth App Client ID. */
	readonly clientId: string;

	/** The Microsoft OAuth App Client Secret. */
	readonly clientSecret: string;

	/** The callback URL for Microsoft OAuth authentication. */
	readonly callbackURL: string;
}
