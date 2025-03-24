/**
 * Zapier authentication configuration for OAuth2 integration with Gauzy
 */

export const authentication = {
	/** Specifies OAuth2 as the authentication type */
	type: 'oauth2',
	/** Configuration for testing the authentication */
	test: {
		url: `${process.env.API_BASE_URL}/api/auth/authenticated`
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
			url: `${process.env.API_BASE_URL}/api/integration/zapier/token/:integrationId`,
			body: {
				code: '{{bundle.inputData.code}}',
				client_id: '{{process.env.CLIENT_ID}}',
				client_secret: '{{process.env.CLIENT_SECRET}}',
				redirect_uri: '{{bundle.inputData.redirect_uri}}',
				grant_type: 'authorization_code'
			},
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		},
		/** Configuration for refreshing access token */
		refreshAccessToken: {
			method: 'POST',
			url: `${process.env.API_BASE_URL}/api/integration/zapier/refresh-token/:integrationId`,
			body: {
				refresh_token: '{{bundle.authData.refresh_token}}',
				client_id: '{{process.env.CLIENT_ID}}',
				client_secret: '{{process.env.CLIENT_SECRET}}',
				grant_type: 'refresh_token'
			},
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		},
		/** OAuth2 scopes required for the integration */
		scope: 'read write'
	},
};
