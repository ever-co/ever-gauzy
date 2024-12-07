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
