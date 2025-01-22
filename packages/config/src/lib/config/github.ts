import { registerAs } from '@nestjs/config';
import { IGithubConfig } from '@gauzy/common';

/**
 * Register GitHub OAuth configuration using @nestjs/config
 */
export default registerAs(
	'github',
	(): IGithubConfig => ({
		// GitHub OAuth Client ID
		clientId: process.env.GAUZY_GITHUB_OAUTH_CLIENT_ID,

		// GitHub OAuth Client Secret
		clientSecret: process.env.GAUZY_GITHUB_OAUTH_CLIENT_SECRET,

		// Callback URL for handling the OAuth response after authentication
		callbackURL:
			process.env.GAUZY_GITHUB_OAUTH_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/github/callback`,

		// User Agent for GitHub API requests
		userAgent: process.env.CLIENT_BASE_URL
	})
);
