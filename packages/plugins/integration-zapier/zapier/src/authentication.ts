/**
 * Zapier authentication configuration for OAuth2 integration with Gauzy
 */
import { ZObject, Bundle } from 'zapier-platform-core';
const appName = process.env.APP_NAME || 'Gauzy';

export const authentication = {
	/** Specifies OAuth2 as the authentication type */
	type: 'oauth2',
	/** Configuration for testing the authentication — uses Zapier-specific endpoint */
	test: {
		url: `${process.env.API_BASE_URL}/api/integration/zapier/auth/test`,
		method: 'GET',
		headers: {
			Authorization: 'Bearer {{bundle.authData.access_token}}'
		}
	},

	/** Connection label to identify this account in the UI */
	connectionLabel: async (z: ZObject, bundle: Bundle) => {
		try {
			const response = await z.request({
				url: `${process.env.API_BASE_URL}/api/integration/zapier/auth/me`,
				headers: {
					Authorization: `Bearer ${bundle.authData.access_token}`
				}
			});
			const data = response.data;
			if (data?.name) {
				return `${data.name} - ${appName}`;
			}
			if (data?.email) {
				return `${data.email} - ${appName}`;
			}

			return `${appName} Connection`;
		} catch (error) {
			return `${appName} Connection`;
		}
	},

	/** OAuth2 specific configuration */
	oauth2Config: {
		/**
		 * Authorization URL — uses the multi-app OAuth provider at
		 * /api/integration/ever-gauzy/oauth/authorize which redirects to
		 * the Gauzy consent page where the user logs in and approves access.
		 */
		authorizeUrl: {
			method: 'GET',
			url: `${process.env.API_BASE_URL}/api/integration/ever-gauzy/oauth/authorize`,
			params: {
				client_id: '{{process.env.CLIENT_ID}}',
				state: '{{bundle.inputData.state}}',
				redirect_uri: '{{bundle.inputData.redirect_uri}}',
				response_type: 'code'
			}
		},
		/**
		 * Token exchange — uses the multi-app OAuth token endpoint which
		 * validates the authorization code and returns a signed JWT.
		 */
		getAccessToken: {
			method: 'POST',
			url: `${process.env.API_BASE_URL}/api/integration/ever-gauzy/oauth/token`,
			body: {
				code: '{{bundle.inputData.code}}',
				client_id: '{{process.env.CLIENT_ID}}',
				client_secret: '{{process.env.CLIENT_SECRET}}',
				redirect_uri: '{{bundle.inputData.redirect_uri}}',
				grant_type: 'authorization_code'
			},
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			}
		},
		/** OAuth2 scopes required for the integration */
		scope: 'zap zap:write authentication',
		/**
		 * Disable auto-refresh — the multi-app OAuth system issues long-lived
		 * JWTs. Configure the Zapier OAuth client's accessTokenTtl for a
		 * long TTL (e.g. 365 days) to avoid frequent reconnections.
		 */
		autoRefresh: false
	}
};
