import { registerAs } from '@nestjs/config';
import { IMicrosoftConfig } from '@gauzy/common';

/**
 * Register Microsoft OAuth configuration using @nestjs/config
 */
export default registerAs(
	'microsoft',
	(): IMicrosoftConfig => ({
		/** The URL for the Microsoft Graph API */
		graphApiURL: process.env.MICROSOFT_GRAPH_API_URL || 'https://graph.microsoft.com/v1.0',

		/** The URL for Microsoft OAuth authorization. */
		authorizationURL:
			process.env.MICROSOFT_AUTHORIZATION_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',

		/** The URL for Microsoft OAuth token retrieval. */
		tokenURL: process.env.MICROSOFT_TOKEN_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/token',

		/** Microsoft OAuth Client ID */
		clientId: process.env.MICROSOFT_CLIENT_ID,

		/** Microsoft OAuth Client Secret */
		clientSecret: process.env.MICROSOFT_CLIENT_SECRET,

		/** Callback URL for handling the OAuth response after authentication */
		callbackURL: process.env.MICROSOFT_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/microsoft/callback`
	})
);
