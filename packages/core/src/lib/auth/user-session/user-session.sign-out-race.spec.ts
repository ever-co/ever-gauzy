import '../../core/entities/internal';

import { UnauthorizedException } from '@nestjs/common';
import { decode, JwtPayload, sign } from 'jsonwebtoken';
import { ACCESS_TOKEN_TYPE } from '../../access-token/type.token';
import { RequestContext } from '../../core/context';
import { REFRESH_TOKEN_TYPE } from '../../refresh-token/type.token';
import { TokenStatus } from '../../token/interfaces/token.interface';
import { AuthService } from '../auth.service';
import { AuthenticatedUserCache } from '../strategies/authenticated-user-cache';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { UserSessionService } from './user-session.service';

/**
 * An organization switch racing the sign-out of its own session (ever-co/ever-gauzy#11921).
 *
 * The switch is authenticated before the sign-out, and mints its token in the session of its request. When its mint
 * reads the session's sign-out marker before the sign-out writes it, and stores the token after the sign-out's last
 * read of the session's tokens, the sign-out leaves that token active in the store: the token is still refused
 * wherever it is judged, by the marker. A mint that comes after the marker is refused outright.
 */

const TENANT = '7c000000-0000-4000-8000-00000000000a';
const USER = '7c000000-0000-4000-8000-0000000000e1';
const ORG = '7c000000-0000-4000-8000-0000000000a1';
const ORG_2 = '7c000000-0000-4000-8000-0000000000a2';

const user = {
	id: USER,
	email: 'marie@ever.co',
	tenantId: TENANT,
	lastOrganizationId: ORG,
	role: { name: 'EMPLOYEE' },
	isActive: true,
	isArchived: false
};

const session = (sessionId: string) => ({ sessionId, sessionStartedAt: '2026-11-14T08:00:00.000Z' });

/** Marie's token store, in memory: her tokens, and the sign-out markers of her sessions. */
function tokenStore() {
	const rows: any[] = [];
	const markers = new Set<string>();
	const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

	const ofType = (tokenType: string) => ({
		generate: jest.fn(async (userId: string, payload: Record<string, unknown>) => {
			const id = `${tokenType}-${rows.length + 1}`;
			const metadata = { ...payload, tokenId: id, tokenType };
			rows.push({ id, userId, tokenType, status: TokenStatus.ACTIVE, expiresAt: future, metadata });
			return sign(metadata, 'secret');
		}),
		findActive: jest.fn(async (userId: string) =>
			rows.filter(
				(row) => row.userId === userId && row.tokenType === tokenType && row.status === TokenStatus.ACTIVE
			)
		),
		findById: jest.fn(
			async (id: string) => rows.find((row) => row.id === id && row.tokenType === tokenType) ?? null
		),
		findRevokedSince: jest.fn(async () => []),
		revokeById: jest.fn(async ({ tokenId, reason }: { tokenId: string; reason: string }) => {
			const row = rows.find((candidate) => candidate.id === tokenId && candidate.status === TokenStatus.ACTIVE);
			if (!row) {
				return false;
			}
			Object.assign(row, { status: TokenStatus.REVOKED, revokedReason: reason });
			return true;
		}),
		markSessionSignedOut: jest.fn(async (userId: string, sessionId: string) => {
			markers.add(`${userId}/${sessionId}`);
		}),
		isSessionSignedOut: jest.fn(async (userId: string, sessionId: string) => markers.has(`${userId}/${sessionId}`)),
		touch: jest.fn(async () => undefined)
	});

	return { rows, markers, access: ofType(ACCESS_TOKEN_TYPE), refresh: ofType(REFRESH_TOKEN_TYPE) };
}

/** The AuthService that mints Marie's tokens into the store; its other collaborators in memory. */
function authService(store: ReturnType<typeof tokenStore>): AuthService {
	const service: AuthService = Object.create(AuthService.prototype);
	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: { findOne: jest.fn(async () => ({ ...user })) },
		typeOrmEmployeeRepository: { findOne: jest.fn(async () => ({ id: 'employee-1', organizationId: ORG_2 })) },
		accessTokenService: store.access,
		refreshTokenService: store.refresh
	});
	return service;
}

/** The strategy that judges Marie's access tokens against the store; her account and memberships are all in order. */
function jwtStrategy(store: ReturnType<typeof tokenStore>): JwtStrategy {
	return new JwtStrategy(
		{ getAuthenticatedUser: jest.fn(async () => ({ ...user })) } as any,
		{
			findOneByIdString: jest.fn(async () => ({
				id: 'employee-1',
				userId: USER,
				organizationId: ORG_2,
				isActive: true,
				isArchived: false
			}))
		} as any,
		{ findOneByOptions: jest.fn(async () => ({ id: 'membership-1' })) } as any,
		{ attachAuthorizationState: jest.fn(async (authenticated: any) => authenticated) } as any,
		new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' }),
		store.access as any
	);
}

/** A request Marie makes with `token`. */
function requestWith(token: string) {
	jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({});
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
	jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(token);
}

/** Lets every pending step of the requests in flight run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => jest.restoreAllMocks());

describe('An organization switch racing the sign-out of its session', () => {
	async function signedInOnPhoneAndLaptop() {
		const store = tokenStore();
		const phone = await store.access.generate(USER, { id: USER, ...session('phone') });
		await store.refresh.generate(USER, { id: USER, ...session('phone') });
		const laptop = await store.access.generate(USER, { id: USER, ...session('laptop') });
		const sessions = new UserSessionService(
			store.access as any,
			store.refresh as any,
			{} as any,
			{} as any,
			{} as any
		);
		return { store, phone, laptop, sessions, service: authService(store), strategy: jwtStrategy(store) };
	}

	it('leaves active the token the switch stores after the sign-out, and refuses it at its first use', async () => {
		const { store, phone, laptop, sessions, service, strategy } = await signedInOnPhoneAndLaptop();

		// The phone switches organization; its mint has read the marker, and stores its token only once let through.
		let storeTheToken: () => void = () => undefined;
		const stored = new Promise<void>((resolve) => (storeTheToken = resolve));
		const generate = store.access.generate.getMockImplementation();
		store.access.generate.mockImplementationOnce(async (...args: [string, Record<string, unknown>]) => {
			await stored;
			return generate(...args);
		});
		requestWith(phone);
		const switching = service.getJwtAccessToken(user, ORG_2);
		await settle();
		expect(store.access.isSessionSignedOut).toHaveBeenCalledWith(USER, 'phone');

		// Meanwhile the laptop signs the phone out, to the end.
		requestWith(laptop);
		await sessions.signOut('phone');

		storeTheToken();
		const switched = await switching;

		const switchedRow = store.rows.find((row) => row.id === (decode(switched) as JwtPayload).tokenId);
		expect(switchedRow).toMatchObject({ status: TokenStatus.ACTIVE, metadata: session('phone') });
		await expect(strategy.validate(decode(switched) as JwtPayload)).rejects.toThrow(UnauthorizedException);
		await expect(strategy.validate(decode(laptop) as JwtPayload)).resolves.toMatchObject({ id: USER });
		const listed = await sessions.listOwn();
		expect(listed.map(({ id }) => id)).toEqual(['laptop']);
	});

	it('mints nothing in the session once the sign-out wrote its marker', async () => {
		const { store, phone, laptop, sessions, service } = await signedInOnPhoneAndLaptop();
		requestWith(laptop);
		await sessions.signOut('phone');
		const tokensBefore = store.rows.length;

		// A switch the phone made just before the sign-out, reaching its mint after it.
		requestWith(phone);
		await expect(service.getJwtAccessToken(user, ORG_2)).rejects.toThrow(UnauthorizedException);
		await expect(service.getJwtRefreshToken(user, ORG_2)).rejects.toThrow(UnauthorizedException);

		expect(store.rows).toHaveLength(tokensBefore);
	});
});
