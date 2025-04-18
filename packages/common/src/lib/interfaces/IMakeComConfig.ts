/**
 * Interface for Make.com integration settings
 */
export interface IMakeComConfig {
    /**
     * Make.com OAuth client ID
     */
    readonly clientId: string;

    /**
     * Make.com OAuth client secret
     */
    readonly clientSecret: string;

    /** Redirect URI */
    readonly redirectUri: string;

    /**
     * Post Install URL
     */
    readonly postInstallUrl: string;
    /**
     * URL for Make.com webhooks to send events to
     */
    readonly webhookUrl: string;
}
