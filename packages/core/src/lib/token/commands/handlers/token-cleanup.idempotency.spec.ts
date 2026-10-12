import '../../../core/entities/internal';

import { FindOperator } from 'typeorm';
import { assertConvergesUnderRepeatedExecution } from '../../../core/testing/idempotency/idempotency.assertions';
import { MultiORMEnum } from '../../../core/utils';
import { TokenStatus } from '../../interfaces/token.interface';
import { TokenRepository } from '../../repositories/token.repository';
import { CleanupExpiredTokensHandler } from './cleanup-expired-tokens-command.handler';
import { CleanupInactiveTokensHandler } from './cleanup-inactive-tokens-command.handler';
import { CleanupExpiredTokensCommand } from '../cleanup-expired-tokens.command';
import { CleanupInactiveTokensCommand } from '../cleanup-inactive-tokens.command';

interface FakeTokenRow {
	id: string;
	tokenType: string;
	status: TokenStatus;
	expiresAt: Date;
	lastUsedAt: Date;
}

/**
 * Matches a row against the WHERE criteria the real `TokenRepository` passes to its bulk `update()`:
 * plain equality and TypeORM's `LessThan`. Any other operator fails the test loudly rather than
 * silently matching nothing.
 */
function matchesCriteria(row: FakeTokenRow, criteria: Record<string, unknown>): boolean {
	return Object.entries(criteria).every(([key, expected]) => {
		const actual = row[key as keyof FakeTokenRow];
		if (expected instanceof FindOperator) {
			if (expected.type !== 'lessThan') {
				throw new Error(`token table: unsupported operator "${expected.type}" on "${key}"`);
			}
			return (actual as Date).getTime() < (expected.value as Date).getTime();
		}
		return actual === expected;
	});
}

/**
 * The REAL `TokenRepository` (what `TokenModule` binds `TokenMaintenanceRepositoryToken` to, and what
 * both cleanup handlers call) over an in-memory token table. Only the TypeORM repository's `update()` is
 * replaced, so the conditional criteria under test (`status: ACTIVE` in `markExpiredTokens` and
 * `revokeInactiveTokens`) are the shipped ones: drop that guard and a retry matches rows again, which the
 * "zero additional rows" cases below catch.
 */
function tokenTable(rows: FakeTokenRow[]) {
	const typeOrmRepository = {
		update: async (criteria: Record<string, unknown>, changes: Partial<FakeTokenRow>) => {
			const matched = rows.filter((row) => matchesCriteria(row, criteria));
			matched.forEach((row) => Object.assign(row, changes));
			return { affected: matched.length, raw: [], generatedMaps: [] };
		}
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const repository = new TokenRepository(typeOrmRepository as any, {} as any);
	// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
	Object.defineProperty(repository, 'ormType', { value: MultiORMEnum.TypeORM });

	return {
		repository,
		/** A fresh, comparable snapshot of every row's status. */
		snapshot: () => rows.map((row) => ({ id: row.id, status: row.status }))
	};
}

function tokenRow(overrides: Partial<FakeTokenRow>): FakeTokenRow {
	return {
		id: 'token-id',
		tokenType: 'refresh',
		status: TokenStatus.ACTIVE,
		expiresAt: new Date(Date.now() + 60_000),
		lastUsedAt: new Date(),
		...overrides
	};
}

/**
 * TASK 4 positive control: these handlers are idempotent BY CONSTRUCTION (a conditional bulk
 * `UPDATE ... WHERE status = 'ACTIVE'`), so a retried/redelivered cleanup job is a safe no-op the
 * second time. Contrast with `employee-notification.idempotency.spec.ts`, which covers a job with no
 * such natural guard, where only an explicit (opt-in) redelivery check can absorb a duplicate.
 */
describe('Token cleanup handlers: idempotent under repeated execution', () => {
	it('CleanupExpiredTokensHandler converges: only newly-expired tokens transition, ever', async () => {
		const { repository, snapshot } = tokenTable([
			tokenRow({ id: 'expired-1', expiresAt: new Date(Date.now() - 60_000) }),
			tokenRow({ id: 'expired-2', expiresAt: new Date(Date.now() - 1_000) }),
			tokenRow({ id: 'still-valid', expiresAt: new Date(Date.now() + 60_000) }),
			// Past its expiry but already revoked: must stay REVOKED, never be re-labelled EXPIRED.
			tokenRow({ id: 'revoked', status: TokenStatus.REVOKED, expiresAt: new Date(Date.now() - 60_000) })
		]);
		const handler = new CleanupExpiredTokensHandler(repository);
		const command = new CleanupExpiredTokensCommand();

		await assertConvergesUnderRepeatedExecution({
			run: () => handler.execute(command),
			snapshot
		});

		expect(snapshot()).toEqual([
			{ id: 'expired-1', status: TokenStatus.EXPIRED },
			{ id: 'expired-2', status: TokenStatus.EXPIRED },
			{ id: 'still-valid', status: TokenStatus.ACTIVE },
			{ id: 'revoked', status: TokenStatus.REVOKED }
		]);
	});

	it('a retry of CleanupExpiredTokensHandler affects zero additional rows (simulates queue redelivery)', async () => {
		const { repository } = tokenTable([tokenRow({ id: 'expired-1', expiresAt: new Date(Date.now() - 60_000) })]);
		const handler = new CleanupExpiredTokensHandler(repository);
		const command = new CleanupExpiredTokensCommand();

		const firstRunAffected = await handler.execute(command);
		const retryAffected = await handler.execute(command);

		expect(firstRunAffected).toBe(1);
		expect(retryAffected).toBe(0);
	});

	it('CleanupInactiveTokensHandler converges: only newly-inactive tokens of the given type transition', async () => {
		const threshold = 30 * 60_000; // 30 minutes
		const { repository, snapshot } = tokenTable([
			tokenRow({ id: 'inactive-refresh', tokenType: 'refresh', lastUsedAt: new Date(Date.now() - 60 * 60_000) }),
			tokenRow({ id: 'active-refresh', tokenType: 'refresh', lastUsedAt: new Date() }),
			// Same inactivity window, but a different token type: must not be touched by this run.
			tokenRow({ id: 'inactive-access', tokenType: 'access', lastUsedAt: new Date(Date.now() - 60 * 60_000) }),
			// Inactive but already expired: must stay EXPIRED, never be re-labelled REVOKED.
			tokenRow({
				id: 'expired-refresh',
				tokenType: 'refresh',
				status: TokenStatus.EXPIRED,
				lastUsedAt: new Date(Date.now() - 60 * 60_000)
			})
		]);
		const handler = new CleanupInactiveTokensHandler(repository);
		const command = new CleanupInactiveTokensCommand('refresh', threshold);

		await assertConvergesUnderRepeatedExecution({
			run: () => handler.execute(command),
			snapshot
		});

		expect(snapshot()).toEqual([
			{ id: 'inactive-refresh', status: TokenStatus.REVOKED },
			{ id: 'active-refresh', status: TokenStatus.ACTIVE },
			{ id: 'inactive-access', status: TokenStatus.ACTIVE },
			{ id: 'expired-refresh', status: TokenStatus.EXPIRED }
		]);
	});

	it('a retry of CleanupInactiveTokensHandler affects zero additional rows (simulates queue redelivery)', async () => {
		const { repository } = tokenTable([
			tokenRow({ id: 'inactive-refresh', tokenType: 'refresh', lastUsedAt: new Date(Date.now() - 60 * 60_000) })
		]);
		const handler = new CleanupInactiveTokensHandler(repository);
		const command = new CleanupInactiveTokensCommand('refresh', 30 * 60_000);

		const firstRunAffected = await handler.execute(command);
		const retryAffected = await handler.execute(command);

		expect(firstRunAffected).toBe(1);
		expect(retryAffected).toBe(0);
	});
});
