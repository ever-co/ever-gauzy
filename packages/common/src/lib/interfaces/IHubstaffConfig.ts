/**
 * Configuration options for Hubstaff integration.
 */
export interface IHubstaffConfig {
    /** The Hubstaff OAuth App Client ID. */
    readonly clientId: string;

    /** The Hubstaff OAuth App Client Secret. */
    readonly clientSecret: string;

    /** The URL to redirect to after Hubstaff App installation. */
    readonly postInstallUrl: string;
}
