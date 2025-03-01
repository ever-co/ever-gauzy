import { registerAs } from '@nestjs/config';
import { IKeycloakConfig } from '@gauzy/common';

/**
 * Register Facebook OAuth configuration using @nestjs/config
 */
export default registerAs(
	'keycloak',
	(): IKeycloakConfig => ({
		// Keycloak OAuth Client ID
		clientId: process.env.KEYCLOAK_CLIENT_ID,

		// Keycloak OAuth Client Secret
		clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,

		// Keycloak OAuth Realm
		realm: process.env.KEYCLOAK_REALM,

		// Keycloak OAuth Auth Server URL
		authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,

		// Keycloak OAuth Cookie Key
		cookieKey: process.env.KEYCLOAK_COOKIE_KEY
	})
);
