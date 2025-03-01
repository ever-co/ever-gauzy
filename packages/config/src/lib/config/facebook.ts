import { registerAs } from '@nestjs/config';
import { IFacebookConfig } from '@gauzy/common';

/**
 * Register Facebook OAuth configuration using @nestjs/config
 */
export default registerAs(
	'facebook',
	(): IFacebookConfig => ({
		// Facebook OAuth Client ID
		clientId: process.env.FACEBOOK_CLIENT_ID,

		// Facebook OAuth Client Secret
		clientSecret: process.env.FACEBOOK_CLIENT_SECRET,

		// Callback URL for handling the OAuth response after authentication
		callbackURL: process.env.FACEBOOK_CALLBACK_URL
	})
);
