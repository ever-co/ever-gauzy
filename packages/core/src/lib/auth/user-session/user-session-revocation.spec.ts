import { TokenStatus } from '../../token/interfaces/token.interface';
import { isSignedOutSessionToken, USER_SESSION_SIGNED_OUT_REASON } from './user-session-revocation';

describe('isSignedOutSessionToken', () => {
	it('is true for a token revoked by a session sign-out only', () => {
		expect(
			isSignedOutSessionToken({ status: TokenStatus.REVOKED, revokedReason: USER_SESSION_SIGNED_OUT_REASON })
		).toBe(true);
		expect(isSignedOutSessionToken({ status: TokenStatus.REVOKED, revokedReason: 'User initiated logout' })).toBe(
			false
		);
		expect(
			isSignedOutSessionToken({ status: TokenStatus.ACTIVE, revokedReason: USER_SESSION_SIGNED_OUT_REASON })
		).toBe(false);
		expect(isSignedOutSessionToken({ status: TokenStatus.ACTIVE, revokedReason: null })).toBe(false);
	});
});
