/**
 * Version information for a running application (API or web UI), embedded at
 * build/deploy time. Used by the web footer to show the deployed version +
 * commit and to detect a drift between the web app and the API.
 */
export interface IAppVersionInfo {
    /** Which application this describes: 'api' or 'web'. */
    name: 'api' | 'web';

    /** Release version, i.e. the git tag the image was built from (e.g. 'v111.2.10'). Empty when unknown. */
    version: string;

    /** Full git commit SHA the image was built from. Empty when unknown. */
    commit: string;
}

/**
 * Interface representing the application configuration.
 */
export interface IAppConfig extends IAppSetting {
    /** The name of the application. */
    app_name: string;

    /** The URL of the application's logo. */
    app_logo: string;
}

/**
 * Interface representing application settings related to user authentication methods.
 */
export interface IAppSetting {
    /** Flag indicating whether email/password login is enabled. */
    email_password_login: boolean;

    /** Flag indicating whether magic login is enabled. */
    magic_login: boolean;

    /** Flag indicating whether GitHub login is enabled. */
    github_login: boolean;

    /** Flag indicating whether Facebook login is enabled. */
    facebook_login: boolean;

    /** Flag indicating whether Google login is enabled. */
    google_login: boolean;

    /** Flag indicating whether Twitter login is enabled. */
    twitter_login: boolean;

    /** Flag indicating whether Microsoft login is enabled. */
    microsoft_login: boolean;

    /** Flag indicating whether LinkedIn login is enabled. */
    linkedin_login: boolean;
}
