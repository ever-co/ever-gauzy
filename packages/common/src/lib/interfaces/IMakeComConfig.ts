/**
 * Configuration interface for Make.com integration settings.
 * This interface defines the necessary properties required
 * to configure OAuth and webhook settings for Make.com.
 */
export interface IMakeComConfig {
    /**
     * The OAuth client ID provided by Make.com.
     * This is used to identify the application during the OAuth flow.
     */
    readonly clientId: string;

    /**
     * The OAuth client secret provided by Make.com.
     * This is used to authenticate the application during the OAuth flow.
     */
    readonly clientSecret: string;

    /**
     * The redirect URI registered with Make.com.
     * After successful authentication, Make.com redirects users to this URI.
     */
    readonly redirectUri: string;

    /**
     * The URL to redirect users to after the integration is installed.
     * Typically used to guide users to a post-installation setup page.
     */
    readonly postInstallUrl: string;

    /**
     * The URL where Make.com sends webhook events.
     * This endpoint should handle incoming events from Make.com.
     */
    readonly webhookUrl: string;
}
