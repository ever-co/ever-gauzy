import 'reflect-metadata';
import { sign } from 'jsonwebtoken';
import { RequestContext } from '../../core/context/request-context';
import {
	currentRequestSessionClaims,
	keepSessionForRequest,
	readSessionClaims,
	sessionForMint,
	sessionOfRefreshToken
} from './user-session-claims';

const MARIE = 'marie-user-id';
const PAUL = 'paul-user-id';

/** A request whose bearer token carries `claims`, made by `userId` (null on a public route). */
function inRequest({ userId, claims }: { userId: string | null; claims?: Record<string, unknown> }) {
	const request = {};
	jest.spyOn(RequestContext, 'currentRequest').mockReturnValue(request);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
	const token = claims ? sign({ id: userId, ...claims }, 'secret') : null;
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(token);
	return request;
}

afterEach(() => jest.restoreAllMocks());

describe('readSessionClaims', () => {
	it('reads both claims of a token', () => {
		expect(readSessionClaims({ sessionId: 's1', sessionStartedAt: '2026-11-14T09:00:00.000Z' })).toEqual({
			sessionId: 's1',
			sessionStartedAt: '2026-11-14T09:00:00.000Z'
		});
	});

	it('answers null for a token minted before sessions were named, or a partial one', () => {
		expect(readSessionClaims({ id: MARIE })).toBeNull();
		expect(readSessionClaims({ sessionId: 's1' })).toBeNull();
		expect(readSessionClaims(null)).toBeNull();
	});
});

describe('sessionForMint', () => {
	it('gives the access and the refresh token of one sign-in the same new session', () => {
		inRequest({ userId: null });
		const now = new Date('2026-11-14T09:00:00.000Z');

		const access = sessionForMint(MARIE, now).claims;
		const refresh = sessionForMint(MARIE, now).claims;

		expect(access.sessionId).toMatch(/^[0-9a-f-]{36}$/);
		expect(refresh).toEqual(access);
		expect(access.sessionStartedAt).toBe('2026-11-14T09:00:00.000Z');
	});

	it('starts a new session for each sign-in request', () => {
		inRequest({ userId: null });
		const first = sessionForMint(MARIE).claims;
		inRequest({ userId: null });
		const second = sessionForMint(MARIE).claims;

		expect(second.sessionId).not.toBe(first.sessionId);
	});

	it('keeps the session of the request when the user switches organization or workspace', () => {
		inRequest({ userId: MARIE, claims: { sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' } });

		expect(sessionForMint(MARIE).claims).toEqual({
			sessionId: 'laptop',
			sessionStartedAt: '2026-11-10T08:00:00.000Z'
		});
	});

	it("never gives another user's token the session of the request", () => {
		inRequest({ userId: MARIE, claims: { sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' } });

		expect(sessionForMint(PAUL).claims.sessionId).not.toBe('laptop');
	});

	it('keeps the session a refresh chose for the user', () => {
		inRequest({ userId: MARIE, claims: { sessionId: 'old-access', sessionStartedAt: '2026-11-01T00:00:00.000Z' } });
		keepSessionForRequest(MARIE, { sessionId: 'phone', sessionStartedAt: '2026-11-12T07:30:00.000Z' });

		expect(sessionForMint(MARIE).claims).toEqual({
			sessionId: 'phone',
			sessionStartedAt: '2026-11-12T07:30:00.000Z'
		});
	});

	it('starts a new session outside a request', () => {
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentToken').mockReturnValue(null);

		const first = sessionForMint(MARIE).claims;
		const second = sessionForMint(MARIE).claims;

		expect(second.sessionId).not.toBe(first.sessionId);
	});

	/** Only a session that existed before the request can have been signed out: only its mint asks (`AuthService`). */
	describe('whether the session existed before the request', () => {
		const laptop = { sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' };

		it('says no for the session a sign-in starts', () => {
			inRequest({ userId: null });

			expect(sessionForMint(MARIE).inherited).toBe(false);
			expect(sessionForMint(MARIE).inherited).toBe(false);
		});

		it('says yes for the session of the request', () => {
			inRequest({ userId: MARIE, claims: laptop });

			expect(sessionForMint(MARIE)).toEqual({ claims: laptop, inherited: true });
		});

		it('says yes for the session of a refresh token, and no for one a refresh starts for an old token', () => {
			inRequest({ userId: MARIE });
			keepSessionForRequest(MARIE, laptop);
			expect(sessionForMint(MARIE).inherited).toBe(true);

			inRequest({ userId: MARIE });
			keepSessionForRequest(MARIE, laptop, false);
			expect(sessionForMint(MARIE).inherited).toBe(false);
		});
	});
});

describe('sessionOfRefreshToken', () => {
	it('keeps the session a refresh token names', () => {
		expect(sessionOfRefreshToken({ sessionId: 's1', sessionStartedAt: '2026-11-10T08:00:00.000Z' })).toEqual({
			sessionId: 's1',
			sessionStartedAt: '2026-11-10T08:00:00.000Z'
		});
	});

	it('starts a session dated from the issue of a token minted before sessions were named', () => {
		const iat = Math.floor(new Date('2026-11-09T07:00:00.000Z').getTime() / 1000);

		const claims = sessionOfRefreshToken({ id: MARIE, iat });

		expect(claims.sessionId).toMatch(/^[0-9a-f-]{36}$/);
		expect(claims.sessionStartedAt).toBe('2026-11-09T07:00:00.000Z');
	});

	it('dates it from now when the token does not say when it was issued', () => {
		const now = new Date('2026-11-14T10:00:00.000Z');

		expect(sessionOfRefreshToken({ id: MARIE }, now).sessionStartedAt).toBe('2026-11-14T10:00:00.000Z');
		expect(sessionOfRefreshToken(null, now).sessionStartedAt).toBe('2026-11-14T10:00:00.000Z');
	});
});

describe('currentRequestSessionClaims', () => {
	it('reads the session of the bearer token', () => {
		inRequest({ userId: MARIE, claims: { sessionId: 'web', sessionStartedAt: '2026-11-14T09:00:00.000Z' } });

		expect(currentRequestSessionClaims()).toEqual({
			sessionId: 'web',
			sessionStartedAt: '2026-11-14T09:00:00.000Z'
		});
	});

	it('answers null without a bearer token', () => {
		inRequest({ userId: null });

		expect(currentRequestSessionClaims()).toBeNull();
	});
});
