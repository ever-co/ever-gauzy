import { registerAs } from '@nestjs/config';

/**
 * Configuration for Feature Flags
 *
 * Defines feature flags and settings related to user authentication methods.
 * The configuration values are registered using the @nestjs/config library.
 *
 * @returns {Object} Object representing the feature flags configuration.
 */
export default registerAs('setting', () => ({
    /** Flag indicating whether email/password login is enabled. */
    email_password_login: process.env.FEATURE_EMAIL_PASSWORD_LOGIN === 'false' ? false : true,

    /** Flag indicating whether magic login is enabled. */
    magic_login: process.env.FEATURE_MAGIC_LOGIN === 'false' ? false : true,

    /** Flag indicating whether GitHub login is enabled. */
    github_login: process.env.FEATURE_GITHUB_LOGIN === 'false' ? false : true,

    /** Flag indicating whether Facebook login is enabled. */
    facebook_login: process.env.FEATURE_FACEBOOK_LOGIN === 'false' ? false : true,

    /** Flag indicating whether Google login is enabled. */
    google_login: process.env.FEATURE_GOOGLE_LOGIN === 'false' ? false : true,

    /** Flag indicating whether Twitter login is enabled. */
    twitter_login: process.env.FEATURE_TWITTER_LOGIN === 'false' ? false : true,

    /** Flag indicating whether Microsoft login is enabled. */
    microsoft_login: process.env.FEATURE_MICROSOFT_LOGIN === 'false' ? false : true,

    /** Flag indicating whether LinkedIn login is enabled. */
    linkedin_login: process.env.FEATURE_LINKEDIN_LOGIN === 'false' ? false : true
}));
