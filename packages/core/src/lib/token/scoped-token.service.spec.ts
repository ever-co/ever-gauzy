import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { RevokeTokenByIdCommand, TouchTokenCommand } from './commands';
import { GetTokenByIdQuery, GetTokensQuery } from './queries';
import { ScopedTokenService } from './scoped-token.service';

function service(found: unknown) {
	const commandBus = { execute: jest.fn(async () => true) };
	const queryBus = {
		execute: jest.fn(async () => {
			if (found instanceof Error) {
				throw found;
			}
			return found;
		})
	};
	const scoped = new ScopedTokenService(
		commandBus as any,
		queryBus as any,
		{ tokenType: 'ACCESS_TOKEN_TYPE' } as any
	);
	return { scoped, commandBus, queryBus };
}

describe('ScopedTokenService, tokens named by their id', () => {
	it('answers a stored token of its own type', async () => {
		const { scoped, queryBus } = service({ id: 't1', tokenType: 'ACCESS_TOKEN_TYPE' });

		await expect(scoped.getTokenById('t1')).resolves.toEqual({ id: 't1', tokenType: 'ACCESS_TOKEN_TYPE' });
		expect(queryBus.execute).toHaveBeenCalledWith(new GetTokenByIdQuery('t1'));
	});

	it('answers null for a token of another type', async () => {
		const { scoped } = service({ id: 't1', tokenType: 'REFRESH_TOKEN_TYPE' });

		await expect(scoped.getTokenById('t1')).resolves.toBeNull();
	});

	it('answers null for an id that names no token', async () => {
		const { scoped } = service(new NotFoundException('Token not found'));

		await expect(scoped.getTokenById('missing')).resolves.toBeNull();
	});

	it('revokes by id within its own type', async () => {
		const { scoped, commandBus } = service(null);

		await scoped.revokeTokenById({ tokenId: 't1', userId: 'u1', revokedById: 'u1', reason: 'why' });

		expect(commandBus.execute).toHaveBeenCalledWith(
			new RevokeTokenByIdCommand({
				tokenId: 't1',
				userId: 'u1',
				revokedById: 'u1',
				reason: 'why',
				tokenType: 'ACCESS_TOKEN_TYPE'
			})
		);
	});

	it('records a use of a token', async () => {
		const { scoped, commandBus } = service(null);

		await scoped.touchToken('t1');

		expect(commandBus.execute).toHaveBeenCalledWith(new TouchTokenCommand('t1'));
	});
});

describe('ScopedTokenService, the revoked tokens of a user since a date', () => {
	/**
	 * 250 revoked tokens, one a second, read by a query double that answers like the token repository's `paginate`:
	 * newest first, `limit` per read, and `offset` taken as a page number (on both ORMs) rather than a row count.
	 */
	let revokedTokens: { id: string; createdAt: Date }[];
	beforeEach(() => {
		revokedTokens = Array.from({ length: 250 }, (_, index) => ({
			id: `t${index}`,
			createdAt: new Date(Date.UTC(2026, 10, 14, 12, 0, index))
		}));
	});
	const queryBus = {
		execute: jest.fn(async (query: GetTokensQuery) => {
			const { createdAfter, createdBefore } = query.filters;
			const matching = revokedTokens
				.filter((token) => !createdAfter || token.createdAt > createdAfter)
				.filter((token) => !createdBefore || token.createdAt <= createdBefore)
				.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
			const limit = query.limit ?? 100;
			const page = query.offset ?? 0;
			let skip = 0;
			if (page > 0) {
				skip = limit * (page - 1);
			}
			return { items: matching.slice(skip, skip + limit), total: matching.length };
		})
	};

	it('reads every one, past the first hundred, whatever the store does with an offset', async () => {
		const scoped = new ScopedTokenService({} as any, queryBus as any, { tokenType: 'ACCESS_TOKEN_TYPE' } as any);

		const tokens = await scoped.getRevokedTokensSince('u1', new Date(Date.UTC(2026, 10, 14)));

		expect(new Set(tokens.map((token) => token.id)).size).toBe(250);
		expect(tokens).toHaveLength(250);
	});

	it('goes on past a full page of tokens created at one instant, to the older ones', async () => {
		const instant = new Date(Date.UTC(2026, 10, 14, 13));
		revokedTokens = [
			...Array.from({ length: 120 }, (_, index) => ({ id: `same${index}`, createdAt: instant })),
			...Array.from({ length: 30 }, (_, index) => ({
				id: `older${index}`,
				createdAt: new Date(Date.UTC(2026, 10, 14, 12, 0, index))
			}))
		];
		const scoped = new ScopedTokenService({} as any, queryBus as any, { tokenType: 'ACCESS_TOKEN_TYPE' } as any);

		const ids = (await scoped.getRevokedTokensSince('u1', new Date(Date.UTC(2026, 10, 14)))).map(({ id }) => id);

		expect(ids.filter((id) => id.startsWith('older'))).toHaveLength(30);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
