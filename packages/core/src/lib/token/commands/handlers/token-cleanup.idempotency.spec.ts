import { assertConvergesUnderRepeatedExecution } from '../../../core/testing/idempotency/idempotency.assertions';
import { TokenStatus } from '../../interfaces/token.interface';
import { ITokenMaintenanceRepository } from '../../interfaces/token-repository.interface';
import { CleanupExpiredTokensHandler } from './cleanup-expired-tokens-command.handler';
import { CleanupInactiveTokensHandler } from './cleanup-inactive-tokens-command.handler';
import { CleanupExpiredTokensCommand } from '../cleanup-expired-tokens.command';
import { CleanupInactiveTokensCommand } from '../cleanup-inactive-tokens.command';

interface FakeTokenRow {
	id: string;
	type: string;
	status: TokenStatus;
	expiresAt: Date;
	lastUsedAt: Date;
}

/**
 * Minimal in-memory stand-in for `ITokenMaintenanceRepository`, mirroring the real
 * `TokenRepository`'s conditional-`UPDATE` semantics (`repositories/token.repository.ts`:
 * `revokeInactiveTokens`/`markExpiredTokens` both filter on `status: ACTIVE`) closely enough to
 * prove the same idempotency property: a row already in its target status is never matched again,
 * so a retry/redelivery of the SAME cleanup job converges to the same end state instead of piling
 * up duplicate transitions or errors.
 */
class InMemoryTokenMaintenanceRepository implements ITokenMaintenanceRepository {
	constructor(private readonly rows: FakeTokenRow[]) {}

	async markExpiredTokens(): Promise<number> {
		const now = Date.now();
		let affected = 0;
		for (const row of this.rows) {
			if (row.status === TokenStatus.ACTIVE && row.expiresAt.getTime() < now) {
				row.status = TokenStatus.EXPIRED;
				affected++;
			}
		}
		return affected;
	}

	async revokeInactiveTokens(tokenType: string, inactivityThresholdMs: number): Promise<number> {
		const cutoff = Date.now() - inactivityThresholdMs;
		let affected = 0;
		for (const row of this.rows) {
			if (row.type === tokenType && row.status === TokenStatus.ACTIVE && row.lastUsedAt.getTime() < cutoff) {
				row.status = TokenStatus.REVOKED;
				affected++;
			}
		}
		return affected;
	}

	async deleteOlderThan(): Promise<number> {
		return 0;
	}

	/** Test-only: a fresh, comparable snapshot of every row's status. */
	snapshot(): Array<{ id: string; status: TokenStatus }> {
		return this.rows.map((row) => ({ id: row.id, status: row.status }));
	}
}

function tokenRow(overrides: Partial<FakeTokenRow>): FakeTokenRow {
	return {
		id: 'token-id',
		type: 'refresh',
		status: TokenStatus.ACTIVE,
		expiresAt: new Date(Date.now() + 60_000),
		lastUsedAt: new Date(),
		...overrides
	};
}

/**
 * TASK 4 positive control: these handlers are idempotent BY CONSTRUCTION (a conditional bulk
 * `UPDATE ... WHERE status = 'ACTIVE'`), so a retried/redelivered cleanup job is a safe no-op the
 * second time — contrast with `employee-notification.idempotency.spec.ts`, which documents a job
 * that is NOT idempotent because it has no equivalent guard.
 */
describe('Token cleanup handlers: idempotent under repeated execution', () => {
	it('CleanupExpiredTokensHandler converges: only newly-expired tokens transition, ever', async () => {
		const repository = new InMemoryTokenMaintenanceRepository([
			tokenRow({ id: 'expired-1', expiresAt: new Date(Date.now() - 60_000) }),
			tokenRow({ id: 'expired-2', expiresAt: new Date(Date.now() - 1_000) }),
			tokenRow({ id: 'still-valid', expiresAt: new Date(Date.now() + 60_000) })
		]);
		const handler = new CleanupExpiredTokensHandler(repository);
		const command = new CleanupExpiredTokensCommand();

		await assertConvergesUnderRepeatedExecution({
			run: () => handler.execute(command),
			snapshot: () => repository.snapshot()
		});

		expect(repository.snapshot()).toEqual([
			{ id: 'expired-1', status: TokenStatus.EXPIRED },
			{ id: 'expired-2', status: TokenStatus.EXPIRED },
			{ id: 'still-valid', status: TokenStatus.ACTIVE }
		]);
	});

	it('a retry of CleanupExpiredTokensHandler affects zero additional rows (simulates queue redelivery)', async () => {
		const repository = new InMemoryTokenMaintenanceRepository([
			tokenRow({ id: 'expired-1', expiresAt: new Date(Date.now() - 60_000) })
		]);
		const handler = new CleanupExpiredTokensHandler(repository);
		const command = new CleanupExpiredTokensCommand();

		const firstRunAffected = await handler.execute(command);
		const retryAffected = await handler.execute(command);

		expect(firstRunAffected).toBe(1);
		expect(retryAffected).toBe(0);
	});

	it('CleanupInactiveTokensHandler converges: only newly-inactive tokens of the given type transition', async () => {
		const threshold = 30 * 60_000; // 30 minutes
		const repository = new InMemoryTokenMaintenanceRepository([
			tokenRow({ id: 'inactive-refresh', type: 'refresh', lastUsedAt: new Date(Date.now() - 60 * 60_000) }),
			tokenRow({ id: 'active-refresh', type: 'refresh', lastUsedAt: new Date() }),
			// Same inactivity window, but a different token type — must not be touched by this run.
			tokenRow({ id: 'inactive-access', type: 'access', lastUsedAt: new Date(Date.now() - 60 * 60_000) })
		]);
		const handler = new CleanupInactiveTokensHandler(repository);
		const command = new CleanupInactiveTokensCommand('refresh', threshold);

		await assertConvergesUnderRepeatedExecution({
			run: () => handler.execute(command),
			snapshot: () => repository.snapshot()
		});

		expect(repository.snapshot()).toEqual([
			{ id: 'inactive-refresh', status: TokenStatus.REVOKED },
			{ id: 'active-refresh', status: TokenStatus.ACTIVE },
			{ id: 'inactive-access', status: TokenStatus.ACTIVE }
		]);
	});
});
