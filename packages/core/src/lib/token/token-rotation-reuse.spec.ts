import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { RotateTokenCommand } from './commands/rotate-token.command';
import { RotateTokenHandler } from './commands/handlers/rotate-token-command.handler';
import { IToken, ITokenConfig, ITokenPayload, TokenStatus } from './interfaces';
import { ValidateTokenHandler } from './queries/handlers/validate-token-query.handler';
import { ValidateTokenQuery } from './queries/validate-token.query';
import { tokenWithRules } from './shared/token-rules';
import { TokenConfigRegistry } from './token-config.registry';

/**
 * A refresh token that was rotated is answered again for a short time (ever-co/ever-gauzy#11955).
 *
 * **The defect.** A rotation answers a new token and refuses the old one from that instant. A client that never
 * received the answer (the network dropped, the computer went to sleep, a proxy timed out), or a second window that
 * sent the same token at the same moment, still holds the old token: its next refresh was answered 401
 * "Token is rotated", and a valid session ended.
 *
 * **What is real here.** The handlers that judge a token (`ValidateTokenHandler`, as the refresh guard asks it) and
 * that rotate one (`RotateTokenHandler`), and the config registry. The store is a table in memory that answers what
 * the repository answers, with the compare-and-set on `version` the rotation relies on; the JWT service and the
 * hasher are stood in for.
 */

const USER = 'marie';
const TOKEN_TYPE = 'REFRESH_TOKEN_TYPE';
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const START = Date.parse('2026-11-14T09:00:00.000Z');

type Row = Partial<IToken> & { id: string; version: number; status: TokenStatus };

/**
 * The stored tokens, and the repository calls the two handlers make on them.
 *
 * @param successorOnTheRelation Whether a token states the one it was rotated to on `rotatedToToken` and leaves
 *   `rotatedToTokenId` empty, as a MikroORM entity does.
 */
function tokenTable(successorOnTheRelation = false) {
	const rows: Row[] = [];
	const writes: string[] = [];
	const find = (id: string) => rows.find((row) => row.id === id);
	// As the repositories answer a token: with its rules, and never the stored row itself
	const answer = (row: Row | undefined) => {
		if (!row) {
			return null;
		}
		const successor = row.rotatedToTokenId ? ({ id: row.rotatedToTokenId } as IToken) : null;
		const stated = successorOnTheRelation
			? { ...row, rotatedToTokenId: null, rotatedToToken: successor }
			: { ...row };
		return tokenWithRules(stated as IToken);
	};

	const repository = {
		findByHash: async (tokenHash: string) => answer(rows.find((row) => row.tokenHash === tokenHash)),
		findByHashWithLock: async (tokenHash: string) => answer(rows.find((row) => row.tokenHash === tokenHash)),
		findById: async (id: string) => answer(find(id)),
		findActiveByUserAndType: async (userId: string, tokenType: string) =>
			rows
				.filter((row) => row.userId === userId && row.tokenType === tokenType && row.status === 'ACTIVE')
				.map((row) => answer(row)),
		create: async (data: Partial<IToken>) => {
			const row = {
				rotatedFromTokenId: null,
				rotatedToTokenId: null,
				revokedAt: null,
				usageCount: 0,
				...data,
				id: randomUUID(),
				version: 1,
				createdAt: new Date(),
				updatedAt: new Date()
			} as Row;
			rows.push(row);
			return answer(row);
		},
		save: async (token: IToken) => {
			Object.assign(find(token.id), { tokenHash: token.tokenHash });
			return token;
		},
		updateStatus: async (id: string, status: TokenStatus, version: number, extra?: Partial<IToken>) => {
			const row = rows.find((candidate) => candidate.id === id && candidate.version === version);
			if (!row) {
				return false;
			}
			Object.assign(row, extra, { status, version: row.version + 1, updatedAt: new Date() });
			writes.push(`${status}:${id}`);
			return true;
		},
		updateLastUsed: async (id: string) => {
			const row = find(id);
			Object.assign(row, { lastUsedAt: new Date(), usageCount: (row.usageCount ?? 0) + 1 });
			writes.push(`USED:${id}`);
		},
		transaction: async <T>(work: (inTransaction: typeof repository) => Promise<T>) => work(repository)
	};

	return { rows, writes, find, repository };
}

/** The refresh tokens of one deployment, with a reuse window of `reuseWindowSeconds` after a rotation. */
function refreshTokens(reuseWindowSeconds: number | undefined, successorOnTheRelation = false) {
	const table = tokenTable(successorOnTheRelation);
	const payloads = new Map<string, ITokenPayload>();
	const jwtService = {
		sign: async (payload: ITokenPayload) => {
			const jwt = `jwt.${payload.tokenId}`;
			payloads.set(jwt, payload);
			return jwt;
		},
		verify: async (jwt: string) => {
			const payload = payloads.get(jwt);
			if (!payload) {
				throw new Error('invalid signature');
			}
			return payload;
		},
		decode: (jwt: string) => payloads.get(jwt) ?? null
	};
	const hasher = { hashToken: (jwt: string) => `hash:${jwt}` };

	const config: ITokenConfig = {
		tokenType: TOKEN_TYPE,
		expiration: 30 * DAY,
		threshold: 7 * DAY,
		allowRotation: true,
		allowMultipleSessions: true,
		...(reuseWindowSeconds === undefined ? {} : { rotationReuseWindow: reuseWindowSeconds * SECOND })
	};
	const registry = new TokenConfigRegistry();
	registry.register(config);
	registry.registerJwtService(TOKEN_TYPE, jwtService as never);

	const validateHandler = new ValidateTokenHandler(
		registry,
		table.repository as never,
		table.repository as never,
		hasher as never
	);
	const rotateHandler = new RotateTokenHandler(table.repository as never, registry, hasher as never);

	/** A sign-in: the first refresh token of a session. */
	const signIn = async () => {
		const row = await table.repository.create({
			userId: USER,
			tokenType: TOKEN_TYPE,
			status: TokenStatus.ACTIVE,
			expiresAt: new Date(Date.now() + 30 * DAY),
			lastUsedAt: new Date(),
			metadata: { sessionId: 'session-1' }
		});
		const jwt = await jwtService.sign({ userId: USER, tokenType: TOKEN_TYPE, tokenId: row.id });
		await table.repository.save({ ...row, tokenHash: hasher.hashToken(jwt) } as IToken);
		return jwt;
	};
	/** What the refresh guard asks of a refresh token. */
	const validate = (jwt: string) =>
		validateHandler.execute(
			new ValidateTokenQuery({ rawToken: jwt, tokenType: TOKEN_TYPE, checkInactivity: true })
		);
	/** What the refresh route asks once the guard has let the token in. */
	const rotate = async (jwt: string) => {
		const rotated = await rotateHandler.execute(
			new RotateTokenCommand({ rawOldToken: jwt, userId: USER, tokenType: TOKEN_TYPE })
		);
		return rotated.token;
	};
	/** A whole refresh, as a client sends it: the guard, then the rotation. Answers the new token, or the refusal. */
	const refresh = async (jwt: string) => {
		const judged = await validate(jwt);
		if (!judged.isValid) {
			return { refused: judged.reason };
		}
		try {
			return { token: await rotate(jwt) };
		} catch (error) {
			return { refused: (error as Error).message };
		}
	};
	const stored = (jwt: string) => table.find(payloads.get(jwt).tokenId);
	/** A sign-out, or any revocation of the session's token. */
	const revoke = (jwt: string) => {
		Object.assign(stored(jwt), { status: TokenStatus.REVOKED, revokedAt: new Date() });
	};

	return { ...table, signIn, validate, rotate, refresh, stored, revoke };
}

/** Time passes. */
const wait = (milliseconds: number) => jest.setSystemTime(Date.now() + milliseconds);

beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(START);
});

afterEach(() => {
	jest.useRealTimers();
});

describe('a refresh token presented again after it was rotated', () => {
	it('renews the session when the answer of its rotation was lost, within the reuse window', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		// The API rotates the token, and the answer never reaches the client
		const lost = (await tokens.refresh(first)).token;
		wait(3 * SECOND);

		// The client still holds the token it sent, and sends it again
		const again = await tokens.refresh(first);

		expect(again.refused).toBeUndefined();
		expect(again.token).not.toBe(lost);
		// The session goes on with the token answered now
		expect((await tokens.validate(again.token)).isValid).toBe(true);
		expect((await tokens.refresh(again.token)).token).toBeDefined();
	});

	it('renews the session where the store states a successor on the relation, as a MikroORM entity does', async () => {
		const tokens = refreshTokens(10, true);
		const first = await tokens.signIn();
		await tokens.refresh(first);
		wait(3 * SECOND);

		const again = await tokens.refresh(first);

		expect(again.refused).toBeUndefined();
		expect((await tokens.validate(again.token)).isValid).toBe(true);
	});

	it('keeps one line of rotations, with one active token at its end', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		const lost = (await tokens.refresh(first)).token;
		wait(3 * SECOND);

		const again = (await tokens.refresh(first)).token;

		// The token whose answer was lost is the one rotated now: no second token beside it
		expect(tokens.stored(first)).toEqual(
			expect.objectContaining({ status: TokenStatus.ROTATED, rotatedToTokenId: tokens.stored(lost).id })
		);
		expect(tokens.stored(lost)).toEqual(
			expect.objectContaining({ status: TokenStatus.ROTATED, rotatedToTokenId: tokens.stored(again).id })
		);
		expect(tokens.stored(again)).toEqual(
			expect.objectContaining({ status: TokenStatus.ACTIVE, rotatedFromTokenId: tokens.stored(lost).id })
		);
		expect(tokens.rows.filter((row) => row.status === TokenStatus.ACTIVE)).toHaveLength(1);
	});

	it('answers a second request that sent the same token at the same moment', async () => {
		const tokens = refreshTokens(10);
		const shared = await tokens.signIn();
		// Two windows send the token together: the guard lets both in while it is active
		expect((await tokens.validate(shared)).isValid).toBe(true);
		expect((await tokens.validate(shared)).isValid).toBe(true);

		const one = await tokens.rotate(shared);
		// The second rotation finds the token rotated by the first, as it does once the row lock is released
		const other = await tokens.rotate(shared);

		expect(other).not.toBe(one);
		expect((await tokens.validate(other)).isValid).toBe(true);
	});

	it('is refused once the reuse window is over', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		await tokens.refresh(first);
		wait(11 * SECOND);

		expect(await tokens.validate(first)).toEqual({ isValid: false, reason: 'Token is rotated' });
		await expect(tokens.rotate(first)).rejects.toThrow('Token is not active');
	});

	it('does not extend the window each time it is presented', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		await tokens.refresh(first);
		wait(6 * SECOND);
		expect((await tokens.refresh(first)).token).toBeDefined();
		wait(6 * SECOND);

		// Twelve seconds after its rotation, six after it was last presented
		expect((await tokens.refresh(first)).refused).toBe('Token is rotated');
	});

	it('leaves the rotated token as its rotation left it', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		await tokens.refresh(first);
		const afterItsRotation = { ...tokens.stored(first) };
		const writesSoFar = tokens.writes.length;
		wait(3 * SECOND);

		await tokens.validate(first);

		expect(tokens.stored(first)).toEqual(afterItsRotation);
		expect(tokens.writes).toHaveLength(writesSoFar);
	});

	it('opens nothing once the token that replaced it is revoked', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		const current = (await tokens.refresh(first)).token;
		// The person signs out with the token they hold
		tokens.revoke(current);
		wait(3 * SECOND);

		expect(await tokens.refresh(first)).toEqual({ refused: 'Token is rotated' });
		await expect(tokens.rotate(first)).rejects.toThrow('Token is not active');
		expect(tokens.rows.filter((row) => row.status === TokenStatus.ACTIVE)).toHaveLength(0);
	});

	it('opens nothing once the token answered to an earlier reuse is revoked', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();
		await tokens.refresh(first);
		wait(2 * SECOND);
		const current = (await tokens.refresh(first)).token;
		tokens.revoke(current);
		wait(2 * SECOND);

		expect(await tokens.refresh(first)).toEqual({ refused: 'Token is rotated' });
	});

	it.each([
		['is not set', undefined],
		['is zero', 0]
	])('is refused at once when the reuse window %s', async (_case, reuseWindowSeconds) => {
		const tokens = refreshTokens(reuseWindowSeconds);
		const first = await tokens.signIn();
		await tokens.refresh(first);

		expect(await tokens.validate(first)).toEqual({ isValid: false, reason: 'Token is rotated' });
		await expect(tokens.rotate(first)).rejects.toThrow('Token is not active');
	});
});

describe('a refresh token that is active', () => {
	it('is rotated as before: the old one is refused once the window is over, the new one renews the session', async () => {
		const tokens = refreshTokens(10);
		const first = await tokens.signIn();

		const second = (await tokens.refresh(first)).token;

		expect(tokens.stored(first)).toEqual(
			expect.objectContaining({ status: TokenStatus.ROTATED, rotatedToTokenId: tokens.stored(second).id })
		);
		expect(tokens.stored(second)).toEqual(
			expect.objectContaining({ status: TokenStatus.ACTIVE, rotatedFromTokenId: tokens.stored(first).id })
		);
		expect((await tokens.validate(second)).isValid).toBe(true);
	});
});
