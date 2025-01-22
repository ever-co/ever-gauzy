import { registerAs } from '@nestjs/config';
import { flagFeatures } from '@gauzy/common';

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
	email_password_login: flagFeatures.FEATURE_EMAIL_PASSWORD_LOGIN,

	/** Flag indicating whether magic login is enabled. */
	magic_login: flagFeatures.FEATURE_MAGIC_LOGIN,

	/** Flag indicating whether GitHub login is enabled. */
	github_login: flagFeatures.FEATURE_GITHUB_LOGIN,

	/** Flag indicating whether Facebook login is enabled. */
	facebook_login: flagFeatures.FEATURE_FACEBOOK_LOGIN,

	/** Flag indicating whether Google login is enabled. */
	google_login: flagFeatures.FEATURE_GOOGLE_LOGIN,

	/** Flag indicating whether Twitter login is enabled. */
	twitter_login: flagFeatures.FEATURE_TWITTER_LOGIN,

	/** Flag indicating whether Microsoft login is enabled. */
	microsoft_login: flagFeatures.FEATURE_MICROSOFT_LOGIN,

	/** Flag indicating whether LinkedIn login is enabled. */
	linkedin_login: flagFeatures.FEATURE_LINKEDIN_LOGIN
}));
