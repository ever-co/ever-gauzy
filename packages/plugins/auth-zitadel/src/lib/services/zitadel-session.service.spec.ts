import { randomUUID } from 'node:crypto';
import { FindOperator } from 'typeorm';
import { InMemoryCache } from '../fixtures/in-memory-accounts';
import { PLATFORM_REFRESH_TOKEN_TYPE, ZitadelTokenBinding } from '../subscribers/zitadel-token-binding';
import { ZitadelTokenSubscriber } from '../subscribers/zitadel-token.subscriber';
import { ZitadelSessionService } from './zitadel-session.service';
import { ZitadelStoreService } from './zitadel-store.service';

type Row = Record<string, any>;

/** Matches one column value, for the TypeORM operators the session service uses. */
function matchesValue(actual: unknown, expected: unknown): boolean {
	if (!(expected instanceof FindOperator)) {
		return actual === expected;
	}
	switch (expected.type) {
		case 'in':
			return (expected.value as unknown[]).includes(actual);
		case 'isNull':
			return actual === null || actual === undefined;
		case 'not':
			return !matchesValue(actual, expected.child ?? expected.value);
		case 'lessThan':
			return (actual as number) < (expected.value as number);
		default:
			throw new Error(`Operator ${expected.type} is not supported by the fake repository`);
	}
}

/** Matches a row against a TypeORM `where` object. */
function matches(row: Row, where: Row): boolean {
	return Object.entries(where).every(([key, expected]) => matchesValue(row[key], expected));
}

/** The slice of a TypeORM repository the session service uses, in memory. */
class FakeRepository {
	readonly rows: Row[] = [];

	create(input: Row): Row {
		return { ...input };
	}
	async save(input: Row | Row[]): Promise<Row | Row[]> {
		const list = Array.isArray(input) ? input : [input];
		for (const row of list) {
			Object.assign(row, { id: row['id'] ?? randomUUID(), isActive: row['isActive'] ?? true, createdAt: new Date() });
			this.rows.push(row);
		}
		return input;
	}
	async insert(input: Row): Promise<void> {
		await this.save(input);
	}
	async find(options: { where: Row }): Promise<Row[]> {
		return this.rows.filter((row) => matches(row, options.where));
	}
	async findOne(options: { where: Row; order?: Row }): Promise<Row | null> {
		const found = await this.find(options);
		if (options.order?.['createdAt'] === 'DESC') {
			found.sort((a, b) => b['createdAt'] - a['createdAt']);
		}
		return found[0] ?? null;
	}
	async update(where: Row, patch: Row): Promise<{ affected: number }> {
		const found = this.rows.filter((row) => matches(row, where));
		for (const row of found) {
			Object.assign(row, patch);
		}
		return { affected: found.length };
	}
	async delete(where: Row): Promise<void> {
		for (let i = this.rows.length - 1; i >= 0; i--) {
			if (matches(this.rows[i], where)) {
				this.rows.splice(i, 1);
			}
		}
	}
}

describe('ZitadelSessionService', () => {
	let sessions: FakeRepository;
	let jtis: FakeRepository;
	let tokens: FakeRepository;
	let cache: InMemoryCache;
	let service: ZitadelSessionService;

	function issueRefreshToken(userId: string, rotatedFromTokenId: string | null = null): Row {
		const token = { id: randomUUID(), userId, tokenType: PLATFORM_REFRESH_TOKEN_TYPE, status: 'ACTIVE', rotatedFromTokenId };
		tokens.rows.push(token);
		return token;
	}

	beforeEach(() => {
		sessions = new FakeRepository();
		jtis = new FakeRepository();
		tokens = new FakeRepository();
		cache = new InMemoryCache();
		service = new ZitadelSessionService(sessions as never, jtis as never, tokens as never, new ZitadelStoreService(cache, null));
	});

	afterEach(() => {
		service.onModuleDestroy();
	});

	it('binds a session to the refresh token of its sign-in and ends only that token chain', async () => {
		await service.record('sid-1', [{ id: 'user-1' }]);
		const everIdToken = issueRefreshToken('user-1');
		await service.bindRefreshToken({ ...everIdToken });
		// The same person later signs in with a password in another browser.
		const passwordToken = issueRefreshToken('user-1');
		await service.bindRefreshToken({ ...passwordToken });
		// The Ever ID session's token is rotated twice.
		const rotated = issueRefreshToken('user-1', everIdToken.id);
		const rotatedAgain = issueRefreshToken('user-1', rotated.id);

		expect(await service.endSessions('sid-1')).toBe(3);

		const status = (token: Row) => tokens.rows.find((row) => row.id === token.id)?.status;
		expect([status(everIdToken), status(rotated), status(rotatedAgain)]).toEqual(['REVOKED', 'REVOKED', 'REVOKED']);
		expect(status(passwordToken)).toBe('ACTIVE');
		expect(sessions.rows).toHaveLength(0);
	});

	it('never binds a rotated token, a token of another user or a record older than the window', async () => {
		await service.record('sid-1', [{ id: 'user-1' }]);
		await service.bindRefreshToken({ ...issueRefreshToken('user-1', 'earlier-token') });
		await service.bindRefreshToken({ ...issueRefreshToken('user-2') });
		expect(sessions.rows[0]['refreshTokenId']).toBeNull();

		// Past the binding window (the store's marker has expired), nothing is bound any more.
		cache.expireAll();
		await service.bindRefreshToken({ ...issueRefreshToken('user-1') });
		expect(sessions.rows[0]['refreshTokenId']).toBeNull();
	});

	it('revokes the token of a sign-in that finishes after its session ended', async () => {
		await service.record('sid-1', [{ id: 'user-1' }]);
		// The logout arrives before the person picked a workspace: nothing to revoke yet.
		expect(await service.endSessions('sid-1')).toBe(0);
		expect(sessions.rows[0]).toEqual(expect.objectContaining({ isActive: false }));

		const late = issueRefreshToken('user-1');
		await service.bindRefreshToken({ ...late });
		await new Promise((resolve) => setImmediate(resolve));
		expect(tokens.rows.find((row) => row.id === late.id)?.status).toBe('REVOKED');
	});

	it('ends every Ever ID session of the given users', async () => {
		await service.record('sid-1', [{ id: 'user-1' }]);
		await service.record('sid-2', [{ id: 'user-1' }, { id: 'user-2' }]);
		const first = issueRefreshToken('user-1');
		await service.bindRefreshToken({ ...first });
		const other = issueRefreshToken('user-2');
		await service.bindRefreshToken({ ...other });

		await service.endSessionsOfUsers(['user-1']);
		expect(tokens.rows.find((row) => row.id === first.id)?.status).toBe('REVOKED');
		expect(tokens.rows.find((row) => row.id === other.id)?.status).toBe('ACTIVE');
	});

	it('remembers a logout token id once', async () => {
		expect(await service.isLogoutJtiKnown('jti-1')).toBe(false);
		expect(await service.rememberLogoutJti('jti-1')).toBe(true);
		expect(await service.rememberLogoutJti('jti-1')).toBe(false);
		expect(await service.isLogoutJtiKnown('jti-1')).toBe(true);
	});

	it('records a sign-in without a session id, so a subject-only logout still ends it', async () => {
		await service.record(undefined, [{ id: 'user-1' }]);
		const token = issueRefreshToken('user-1');
		await service.bindRefreshToken({ ...token });
		await service.endSessionsOfUsers(['user-1']);
		expect(tokens.rows.find((row) => row.id === token.id)?.status).toBe('REVOKED');
	});

	it('also revokes a sign-in that bound its record while the logout was marking it ended', async () => {
		await service.record('sid-1', [{ id: 'user-1' }]);
		const token = issueRefreshToken('user-1');
		// The binding lands between the logout reading the record (unbound) and marking it ended.
		const update = sessions.update.bind(sessions);
		jest.spyOn(sessions, 'update').mockImplementation(async (where: Row, patch: Row) => {
			if (patch['isActive'] === false) {
				await service.bindRefreshToken({ ...token });
			}
			return update(where, patch);
		});
		await service.endSessions('sid-1');
		expect(tokens.rows.find((row) => row.id === token.id)?.status).toBe('REVOKED');
	});

	it('keeps the binding marker when binding fails, and binds on the retry', async () => {
		jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
		try {
			await service.record('sid-1', [{ id: 'user-1' }]);
			const token = issueRefreshToken('user-1');
			jest.spyOn(sessions, 'update').mockRejectedValueOnce(new Error('database unavailable'));
			await service.bindRefreshToken({ ...token });
			expect(sessions.rows[0]['refreshTokenId']).toBeNull();
			await jest.advanceTimersByTimeAsync(1000);
			expect(sessions.rows[0]['refreshTokenId']).toBe(token.id);
		} finally {
			jest.useRealTimers();
		}
	});

	it('receives fresh refresh tokens through the entity subscriber once the plugin started', async () => {
		const subscriber = new ZitadelTokenSubscriber();
		const bind = jest.spyOn(service, 'bindRefreshToken').mockResolvedValue(undefined);

		await subscriber.afterEntityCreate({ id: 't-1', userId: 'user-1', tokenType: PLATFORM_REFRESH_TOKEN_TYPE } as never);
		await new Promise((resolve) => setImmediate(resolve));
		expect(bind).not.toHaveBeenCalled();

		service.onModuleInit();
		expect(ZitadelTokenBinding.current()).toBe(service);
		await subscriber.afterEntityCreate({ id: 't-2', userId: 'user-1', tokenType: PLATFORM_REFRESH_TOKEN_TYPE } as never);
		await subscriber.afterEntityCreate({ id: 't-3', userId: 'user-1', tokenType: 'ACCESS_TOKEN_TYPE' } as never);
		await subscriber.afterEntityCreate({
			id: 't-4',
			userId: 'user-1',
			tokenType: PLATFORM_REFRESH_TOKEN_TYPE,
			rotatedFromTokenId: 't-2'
		} as never);
		await new Promise((resolve) => setImmediate(resolve));
		expect(bind.mock.calls.map(([token]) => token.id)).toEqual(['t-2']);

		service.onModuleDestroy();
		expect(ZitadelTokenBinding.current()).toBeNull();
	});
});
