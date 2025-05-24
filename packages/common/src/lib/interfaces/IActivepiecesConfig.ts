/**
 * Configuration interface for Activepieces integration settings.
 * This interface defines the necessary properties required
 * to configure OAuth and webhook settings for Activepieces.
 */

export interface IActivepiecesConfig {
    /**
     * The OAuth client ID provided by Activepieces.
     * This is used to identify the application during the OAuth flow.
     */
    readonly clientId: string;

    /**
     * The OAuth client secret provided by Activepieces.
     * This is used to authenticate the application during the OAuth flow.
     */
    readonly clientSecret: string;

    /**
     * The redirect URI registered with Activepieces.
     */
    readonly callbackUrl: string;
}
