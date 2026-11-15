import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { TokenStatus } from '../../interfaces/token.interface';
import { IsSessionSignedOutHandler } from '../../queries/handlers/is-session-signed-out-query.handler';
import { IsSessionSignedOutQuery } from '../../queries/is-session-signed-out.query';
import { TokenHasherService } from '../../services/token-hasher.service';
import { SESSION_SIGN_OUT_MARKER_TYPE } from '../../shared/session-sign-out-marker';
import { MarkSessionSignedOutCommand } from '../mark-session-signed-out.command';
import { MarkSessionSignedOutHandler } from './mark-session-signed-out-command.handler';

const EXPIRES_AT = new Date('2026-12-14T08:00:00.000Z');
const REASON = 'Session signed out by its user';

/**
 * A token table keyed by hash, with the unique hash index. A hash it does not hold is answered as the repository
 * answers it: by throwing `NotFoundException`.
 */
function table() {
	const rows = new Map<string, Record<string, any>>();
	const read = {
		findByHash: jest.fn(async (tokenHash: string) => {
			const row = rows.get(tokenHash);
			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}
			return { ...row };
		})
	};
	const write = {
		create: jest.fn(async (data: Record<string, any>) => {
			if (rows.has(data.tokenHash)) {
				throw new Error('duplicate key value violates unique constraint');
			}
			const row = { id: `row-${rows.size + 1}`, ...data };
			rows.set(data.tokenHash, row);
			return row;
		})
	};
	return { rows, read, write };
}

function handlers() {
	const store = table();
	const hasher = new TokenHasherService();
	const mark = new MarkSessionSignedOutHandler(store.read as any, store.write as any, hasher);
	const query = new IsSessionSignedOutHandler(store.read as any, hasher);
	const markSignedOut = (userId: string, sessionId: string) =>
		mark.execute(new MarkSessionSignedOutCommand(userId, sessionId, EXPIRES_AT, REASON));
	const isSignedOut = (userId: string, sessionId: string) =>
		query.execute(new IsSessionSignedOutQuery(userId, sessionId));
	return { store, markSignedOut, isSignedOut };
}

/**
 * The marker a session sign-out writes (ever-co/ever-gauzy#11921): every token of the session is refused once it is
 * there, so it is read on every request of a session, and must be found by one read.
 */
describe('the sign-out marker of a session', () => {
	it('is absent until the session is signed out, and present after', async () => {
		const { markSignedOut, isSignedOut } = handlers();

		await expect(isSignedOut('marie', 'laptop')).resolves.toBe(false);
		await markSignedOut('marie', 'laptop');
		await expect(isSignedOut('marie', 'laptop')).resolves.toBe(true);
	});

	it('names one session of one user', async () => {
		const { markSignedOut, isSignedOut } = handlers();

		await markSignedOut('marie', 'laptop');

		await expect(isSignedOut('marie', 'phone')).resolves.toBe(false);
		await expect(isSignedOut('paul', 'laptop')).resolves.toBe(false);
	});

	it('is a revoked row of its own type, kept until the given expiry, under a hash of user and session', async () => {
		const { store, markSignedOut } = handlers();

		await markSignedOut('marie', 'laptop');

		const [row] = [...store.rows.values()];
		expect(row).toMatchObject({
			userId: 'marie',
			tokenType: SESSION_SIGN_OUT_MARKER_TYPE,
			status: TokenStatus.REVOKED,
			expiresAt: EXPIRES_AT,
			revokedReason: REASON,
			metadata: { sessionId: 'laptop' }
		});
		expect(row.revokedAt).toBeInstanceOf(Date);
		expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is written once when the session is signed out twice', async () => {
		const { store, markSignedOut } = handlers();

		await markSignedOut('marie', 'laptop');
		await markSignedOut('marie', 'laptop');

		expect(store.write.create).toHaveBeenCalledTimes(1);
		expect(store.rows.size).toBe(1);
	});

	it('lets the losing one of two racing sign-outs find the marker the other wrote', async () => {
		const { store, markSignedOut } = handlers();

		// Both read before either writes: the second write meets the unique hash.
		await expect(
			Promise.all([markSignedOut('marie', 'laptop'), markSignedOut('marie', 'laptop')])
		).resolves.toEqual([undefined, undefined]);

		expect(store.write.create).toHaveBeenCalledTimes(2);
		expect(store.rows.size).toBe(1);
	});

	it('passes on a failed write that left no marker', async () => {
		const { store, markSignedOut } = handlers();
		store.write.create.mockRejectedValueOnce(new Error('connection lost'));

		await expect(markSignedOut('marie', 'laptop')).rejects.toThrow('connection lost');
	});

	it('passes on a failed read', async () => {
		const { store, isSignedOut } = handlers();
		store.read.findByHash.mockRejectedValueOnce(new Error('connection lost'));

		await expect(isSignedOut('marie', 'laptop')).rejects.toThrow('connection lost');
	});
});
