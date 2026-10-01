import { isKeycloakConfigured, isKeycloakEnabled } from './auth-keycloak.config';

describe('Keycloak plugin switch', () => {
	const configured = {
		KEYCLOAK_CLIENT_ID: 'gauzy',
		KEYCLOAK_CLIENT_SECRET: 'not-a-placeholder',
		KEYCLOAK_REALM: 'gauzy',
		KEYCLOAK_AUTH_SERVER_URL: 'https://id.example.test'
	};

	it('is off unless KEYCLOAK_ENABLED is exactly "true"', () => {
		expect(isKeycloakEnabled({ ...configured })).toBe(false);
		expect(isKeycloakEnabled({ ...configured, KEYCLOAK_ENABLED: 'false' })).toBe(false);
		for (const value of ['TRUE', '1', 'yes', 'on']) {
			expect(isKeycloakEnabled({ ...configured, KEYCLOAK_ENABLED: value })).toBe(false);
		}
		expect(isKeycloakEnabled({ ...configured, KEYCLOAK_ENABLED: 'true' })).toBe(true);
	});

	it('also needs a real client id and secret', () => {
		expect(isKeycloakEnabled({ KEYCLOAK_ENABLED: 'true' })).toBe(false);
		expect(isKeycloakEnabled({ KEYCLOAK_ENABLED: 'true', KEYCLOAK_CLIENT_ID: 'gauzy' })).toBe(false);
		// The sample files ship this placeholder for both values.
		expect(isKeycloakConfigured({ KEYCLOAK_CLIENT_ID: 'XXXXXXX', KEYCLOAK_CLIENT_SECRET: 'XXXXXXX' })).toBe(false);
		expect(isKeycloakConfigured({ KEYCLOAK_CLIENT_ID: ' ', KEYCLOAK_CLIENT_SECRET: ' ' })).toBe(false);
		expect(isKeycloakConfigured(configured)).toBe(true);
	});

	it('also needs a realm and a real auth server URL, like the sign-in itself', () => {
		expect(isKeycloakConfigured({ ...configured, KEYCLOAK_REALM: '' })).toBe(false);
		expect(isKeycloakConfigured({ ...configured, KEYCLOAK_AUTH_SERVER_URL: '' })).toBe(false);
		expect(isKeycloakConfigured({ ...configured, KEYCLOAK_AUTH_SERVER_URL: 'https://keycloak.example.com/auth' })).toBe(false);
		expect(isKeycloakConfigured({ ...configured, KEYCLOAK_AUTH_SERVER_URL: 'https://keycloak.example.com/auth/' })).toBe(false);
	});
});
