import { IAccessTokenSecretPair, isUpworkExistingAuthorization } from './upwork.model';

describe('isUpworkExistingAuthorization', () => {
	it('recognizes an integration that already completed the handshake', () => {
		expect(isUpworkExistingAuthorization({ integrationId: 'integration-1', organizationId: 'org-1' })).toBe(true);
	});

	it('treats a result with an authorization URL as a handshake to complete', () => {
		expect(isUpworkExistingAuthorization({ url: 'https://upwork.test/authorize', requestToken: 'token' })).toBe(
			false
		);
	});

	it('does not treat an empty or malformed response as an authorized integration', () => {
		expect(isUpworkExistingAuthorization(undefined as unknown as IAccessTokenSecretPair)).toBe(false);
		expect(isUpworkExistingAuthorization({} as IAccessTokenSecretPair)).toBe(false);
	});
});
