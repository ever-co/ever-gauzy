import { registerAs } from '@nestjs/config';
import { IGoogleConfig } from '@gauzy/common';

/**
 * Register Google OAuth configuration using @nestjs/config
 */
export default registerAs(
	'google',
	(): IGoogleConfig => ({
		// Google OAuth Client ID
		clientId: process.env.GOOGLE_CLIENT_ID,

		// Google OAuth Client Secret
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,

		// Callback URL for handling the OAuth response after authentication
		callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/google/callback`
	})
);
