import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { RevokeTokenByIdCommand, TouchTokenCommand } from './commands';
import { GetTokenByIdQuery } from './queries';
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
