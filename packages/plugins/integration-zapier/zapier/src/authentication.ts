/**
 * Zapier authentication configuration for OAuth2 integration with Gauzy
 */
import { ZObject, Bundle } from 'zapier-platform-core';
const appName = process.env.APP_NAME || 'Gauzy';

export const authentication = {
	/** Specifies OAuth2 as the authentication type */
	type: 'oauth2',
	/** Configuration for testing the authentication */
	test: {
		url: `${process.env.API_BASE_URL}/api/auth/authenticated`,
		method: 'GET',
		headers: {
			Authorization: 'Bearer {{bundle.authData.access_token}}'
		}
	},

	/** Connection label to identify this account in the UI */
	connectionLabel: async (z: ZObject, bundle: Bundle) => {
		try {
			const response = await z.request({
				url: `${process.env.API_BASE_URL}/api/user/me`,
				headers: {
					Authorization: `Bearer ${bundle.authData.access_token}`
				}
			});
			// Format the connection label with user information
			const userData = response.data;
			if (userData?.name) {
				return `${userData.name} - ${appName}`;
			}
			if (userData?.email) {
				return `${userData.email} - ${appName}`;
			}

			return `${appName} Connection`;
		} catch (error) {
			return `${appName} Connection`;
		}
	},

	/** OAuth2 specific configuration */
	oauth2Config: {
		/** Configuration for the authorization URL */
		authorizeUrl: {
			method: 'GET',
			url: `${process.env.API_BASE_URL}/api/integration/zapier/oauth/authorize`,
			params: {
				client_id: '{{process.env.CLIENT_ID}}',
				state: '{{bundle.inputData.state}}',
				redirect_uri: '{{bundle.inputData.redirect_uri}}',
				response_type: 'code'
			}
		},
		/** Configuration for obtaining access token */
		getAccessToken: {
			method: 'POST',
			url: `${process.env.API_BASE_URL}/api/integration/zapier/token`,
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
		/** Configuration for refreshing access token */
		refreshAccessToken: {
			method: 'POST',
			url: `${process.env.API_BASE_URL}/api/integration/zapier/refresh-token`,
			body: {
				refresh_token: '{{bundle.authData.refresh_token}}',
				client_id: '{{process.env.CLIENT_ID}}',
				client_secret: '{{process.env.CLIENT_SECRET}}',
				grant_type: 'refresh_token'
			},
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			}
		},
		/** OAuth2 scopes required for the integration */
		scope: 'zap zap:write authentication',
		/** Enable automatic token refresh */
		autoRefresh: true
	}
};
