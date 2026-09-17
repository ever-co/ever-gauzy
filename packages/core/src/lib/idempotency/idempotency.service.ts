import { Injectable, NotFoundException } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IIdempotencyClaim,
	IIdempotencyCompletion,
	IIdempotencyKey,
	IIdempotencyStartInput,
	IdempotencyOutcome,
	IdempotencyStatus
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { IdempotencyKey } from './idempotency-key.entity';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';
import { MikroOrmIdempotencyKeyRepository } from './repository/mikro-orm-idempotency-key.repository';

/**
 * The two windows the claim decision depends on.
 */
export interface IIdempotencyPolicy {
	/** How long a stored response stays replayable. */
	retentionMs?: number;
	/** How long a claim may sit before another request is allowed to take it over. */
	staleLockMs?: number;
}

/**
 * Makes retryable requests safe to retry.
 *
 * A request presents a key and a hash of its body. The first request inserts the key and owns the
 * work; a concurrent request with the same key is told the work is in flight instead of repeating
 * it; a request that arrives after the work finished is handed the stored response and the work is
 * not executed again. The insert is the lock — the unique tuple `(organizationId, scope, key)` is
 * what makes two concurrent identical requests resolve to exactly one owner, with no lock table and
 * no cooperation from the caller.
 *
 * The service answers with outcomes rather than exceptions, because what a client should be told
 * (`409` for in flight, `422` for a reused key, the stored response for a replay) is a transport
 * decision the caller owns.
 */
@Injectable()
export class IdempotencyService extends CrudService<IdempotencyKey> {
	/** A stored response is replayable for a day by default; the cleanup job deletes past that. */
	static readonly DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

	/**
	 * How long a claim may be held before it is treated as abandoned.
	 *
	 * A request whose process died between claiming the key and completing it would otherwise hold
	 * the key forever, and the client could never retry. The window is short because the alternative
	 * — a second writer taking over live work — duplicates a side effect.
	 */
	static readonly DEFAULT_STALE_LOCK_MS = 2 * 60 * 1000;

	constructor(
		readonly typeOrmIdempotencyKeyRepository: TypeOrmIdempotencyKeyRepository,
		readonly mikroOrmIdempotencyKeyRepository: MikroOrmIdempotencyKeyRepository
	) {
		super(typeOrmIdempotencyKeyRepository, mikroOrmIdempotencyKeyRepository);
	}

	/**
	 * Claims a key for the caller, or explains why it cannot be claimed.
	 *
	 * @param input The scope, key and request hash the caller presented.
	 * @param policy Overrides for the retention and stale-lock windows.
	 * @returns A claim the caller owns, or the stored response, or the reason it must wait.
	 */
	async startOrReplay(input: IIdempotencyStartInput, policy: IIdempotencyPolicy = {}): Promise<IIdempotencyClaim> {
		const existing = await this.findByKey(input.scope, input.key);

		if (existing) {
			return this.resolveExisting(existing, input, policy);
		}

		const now = new Date();
		const retentionMs = policy.retentionMs ?? IdempotencyService.DEFAULT_RETENTION_MS;

		const claim = this.typeOrmIdempotencyKeyRepository.create({
			key: input.key,
			scope: input.scope,
			requestHash: input.requestHash,
			status: IdempotencyStatus.IN_PROGRESS,
			resourceType: input.resourceType,
			resourceId: input.resourceId,
			expiresAt: new Date(now.getTime() + retentionMs),
			lockedAt: now,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as Partial<IdempotencyKey>);

		try {
			const record = await this.typeOrmIdempotencyKeyRepository.save(claim);

			return { outcome: IdempotencyOutcome.CLAIMED, record };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// The insert is the lock, so a unique violation is not a failure: another request won the
			// race between our read and our write, and its row is the answer.
			const raced = await this.findByKey(input.scope, input.key);

			if (!raced) {
				// The winner was deleted between our insert and this read. Surfacing the original error
				// is the honest answer: the caller may simply retry and claim the key itself.
				throw error;
			}

			return this.resolveExisting(raced, input, policy);
		}
	}

	/**
	 * Claims a key for the caller, treating a row past its retention window as free.
	 *
	 * `startOrReplay` answers from whatever row the key resolves to, and a row only means something
	 * while its response is still replayable. Past `expiresAt` it is dead weight that still occupies
	 * the unique tuple, so it is cleared here exactly as the cleanup job would clear it and the
	 * request then claims the key as if it had never been presented. Without this, a key reused
	 * after its window would be answered with a response the platform promised not to keep.
	 *
	 * @param input The scope, key and request hash the caller presented.
	 * @param policy Overrides for the retention and stale-lock windows.
	 * @returns A claim the caller owns, or the stored response, or the reason it must wait.
	 */
	async claim(input: IIdempotencyStartInput, policy: IIdempotencyPolicy = {}): Promise<IIdempotencyClaim> {
		const existing = await this.findByKey(input.scope, input.key);

		if (existing && this.isExpired(existing)) {
			await this.clearExpired(existing.id);
		}

		return this.startOrReplay(input, policy);
	}

	/**
	 * Whether a stored row is past the window its response may be replayed in.
	 *
	 * @param record The stored row, or anything carrying its expiry.
	 * @param now The moment to compare against.
	 * @returns True when the row must no longer be replayed.
	 */
	isExpired(record: Pick<IdempotencyKey, 'expiresAt'>, now: Date = new Date()): boolean {
		if (!record?.expiresAt) {
			return false;
		}

		const expiry = new Date(record.expiresAt).getTime();

		return Number.isFinite(expiry) && expiry <= now.getTime();
	}

	/**
	 * Deletes expired rows, bounded by `limit`.
	 *
	 * The cleanup job calls this on a schedule. Two rules shape it: a row whose response is still
	 * inside its window is never deleted, and an `IN_PROGRESS` row is only deleted once its lock is
	 * stale — deleting a live lease would let a retry start a second run of work that is still
	 * executing, which is the one outcome the key exists to prevent.
	 *
	 * The criteria are asserted twice, once to pick the rows and once to delete them, so a row that
	 * completed or was refreshed between the two statements survives.
	 *
	 * @param limit The maximum number of rows to delete in one sweep.
	 * @param policy Overrides for the stale-lock window.
	 * @returns How many rows were deleted.
	 */
	async purgeExpired(limit: number = 500, policy: IIdempotencyPolicy = {}): Promise<number> {
		if (!Number.isFinite(limit) || limit <= 0) {
			return 0;
		}

		const now = new Date();
		const staleLockMs = policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS;
		const abandonedBefore = new Date(now.getTime() - Math.max(staleLockMs, 0));

		const terminal = await this.typeOrmIdempotencyKeyRepository.find({
			where: {
				expiresAt: LessThan(now),
				status: In([IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED])
			} as any,
			select: ['id'] as any,
			take: limit
		});

		const remaining = limit - terminal.length;
		const abandoned =
			remaining > 0
				? await this.typeOrmIdempotencyKeyRepository.find({
						where: {
							expiresAt: LessThan(now),
							status: IdempotencyStatus.IN_PROGRESS,
							lockedAt: LessThan(abandonedBefore)
						} as any,
						select: ['id'] as any,
						take: remaining
				  })
				: [];

		const terminalIds = terminal.map((row) => row.id);
		const abandonedIds = abandoned.map((row) => row.id);

		if (terminalIds.length) {
			await this.typeOrmIdempotencyKeyRepository.delete({
				id: In(terminalIds),
				expiresAt: LessThan(now),
				status: In([IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED])
			} as any);
		}

		if (abandonedIds.length) {
			await this.typeOrmIdempotencyKeyRepository.delete({
				id: In(abandonedIds),
				expiresAt: LessThan(now),
				status: IdempotencyStatus.IN_PROGRESS,
				lockedAt: LessThan(abandonedBefore)
			} as any);
		}

		return terminalIds.length + abandonedIds.length;
	}

	/**
	 * Clears one expired row, but only while it is still expired.
	 *
	 * @param id The row id.
	 */
	private async clearExpired(id: ID): Promise<void> {
		await this.typeOrmIdempotencyKeyRepository.delete({
			id,
			expiresAt: LessThan(new Date())
		} as any);
	}

	/**
	 * Stores the successful outcome of a claimed key.
	 *
	 * @param record The claimed row, or its id.
	 * @param completion The response a replay returns.
	 * @returns The settled row.
	 * @throws NotFoundException when the row no longer exists.
	 */
	async complete(
		record: IdempotencyKey | ID,
		completion: IIdempotencyCompletion = {}
	): Promise<IdempotencyKey> {
		return this.settle(record, IdempotencyStatus.COMPLETED, completion);
	}

	/**
	 * Stores the terminal failure of a claimed key.
	 *
	 * The key stays claimed under `FAILED` rather than being released: a client that retries under a
	 * key whose request was refused gets the refusal replayed, which is what stops a broken request
	 * from being retried forever. A client that wants a fresh attempt uses a fresh key.
	 *
	 * @param record The claimed row, or its id.
	 * @param completion The error response a replay returns.
	 * @returns The settled row.
	 * @throws NotFoundException when the row no longer exists.
	 */
	async fail(record: IdempotencyKey | ID, completion: IIdempotencyCompletion = {}): Promise<IdempotencyKey> {
		return this.settle(record, IdempotencyStatus.FAILED, completion);
	}

	/**
	 * Finds the row a key resolves to within the current tenant and organization.
	 *
	 * @param scope The operation namespace.
	 * @param key The client-supplied key.
	 * @returns The row, or null when the key has never been presented.
	 */
	async findByKey(scope: string, key: string): Promise<IdempotencyKey | null> {
		return this.typeOrmIdempotencyKeyRepository.findOne({
			where: {
				scope,
				key,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});
	}

	/**
	 * Finds a row by id.
	 *
	 * @param id The row id.
	 * @returns The row, or null.
	 */
	async findById(id: ID): Promise<IdempotencyKey | null> {
		return this.typeOrmIdempotencyKeyRepository.findOne({ where: { id } as any });
	}

	/**
	 * Decides what an already stored key means for the request that just presented it.
	 *
	 * @param existing The stored row.
	 * @param input The request that presented the key.
	 * @param policy Overrides for the retention and stale-lock windows.
	 * @returns The claim decision.
	 */
	private async resolveExisting(
		existing: IdempotencyKey,
		input: IIdempotencyStartInput,
		policy: IIdempotencyPolicy
	): Promise<IIdempotencyClaim> {
		if (existing.requestHash !== input.requestHash) {
			// Same key, different body: replaying the first response would answer a question the caller
			// did not ask, and running the work would apply a request the key was never meant to cover.
			return { outcome: IdempotencyOutcome.REUSED_KEY, record: existing };
		}

		if (existing.status === IdempotencyStatus.COMPLETED || existing.status === IdempotencyStatus.FAILED) {
			return {
				outcome: IdempotencyOutcome.REPLAYED,
				record: existing,
				response: {
					status: existing.responseStatus ?? 200,
					body: existing.responseBody
				}
			};
		}

		const staleLockMs = policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS;
		const lockedAt = existing.lockedAt ? new Date(existing.lockedAt).getTime() : 0;
		const lockAgeMs = Date.now() - lockedAt;

		if (lockAgeMs > staleLockMs) {
			const takenOver = await this.takeOver(existing.id, policy);

			if (takenOver) {
				return { outcome: IdempotencyOutcome.CLAIMED, record: takenOver };
			}
		}

		// Another request holds the key and is still working. The caller is told to come back rather
		// than to run the work, which is the whole point of the key.
		return {
			outcome: IdempotencyOutcome.IN_FLIGHT,
			record: existing,
			retryAfterMs: Math.max(0, staleLockMs - lockAgeMs)
		};
	}

	/**
	 * Re-claims a key whose holder disappeared.
	 *
	 * The read and the write share a transaction and the row is locked where the dialect supports
	 * it, so two requests cannot both decide that the same abandoned claim is theirs to take.
	 *
	 * @param id The row id.
	 * @param policy Overrides for the retention window.
	 * @returns The re-claimed row, or null when the claim turned out to be live after all.
	 */
	private async takeOver(id: ID, policy: IIdempotencyPolicy): Promise<IdempotencyKey | null> {
		const staleLockMs = policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS;
		const retentionMs = policy.retentionMs ?? IdempotencyService.DEFAULT_RETENTION_MS;

		return this.typeOrmIdempotencyKeyRepository.manager.transaction(async (manager) => {
			const query = manager
				.createQueryBuilder(IdempotencyKey, 'idempotencyKey')
				.where({ id, status: IdempotencyStatus.IN_PROGRESS });

			const current =
				isPostgres() || isMySQL()
					? // `pessimistic_write` maps to FOR UPDATE on both dialects, which is what makes the
					  // staleness check and the takeover one indivisible decision.
					  await query.setLock('pessimistic_write').getOne()
					: // The embedded dialect serializes writers, so the surrounding transaction is the lock.
					  await query.getOne();

			if (!current) {
				return null;
			}

			const lockedAt = current.lockedAt ? new Date(current.lockedAt).getTime() : 0;

			if (Date.now() - lockedAt <= staleLockMs) {
				// The holder is alive; the caller must wait rather than duplicate the work.
				return null;
			}

			const now = new Date();

			current.lockedAt = now;
			current.expiresAt = new Date(now.getTime() + retentionMs);

			return manager.save(IdempotencyKey, current);
		});
	}

	/**
	 * Writes a terminal outcome onto a claimed row.
	 *
	 * A row that is already terminal is returned untouched: completing twice (a crash between the
	 * write and the response, then a retry) must not replace the response a replay would hand back.
	 *
	 * @param record The claimed row, or its id.
	 * @param status The terminal status to record.
	 * @param completion The response to store.
	 * @returns The settled row.
	 * @throws NotFoundException when the row no longer exists.
	 */
	private async settle(
		record: IdempotencyKey | ID,
		status: IdempotencyStatus,
		completion: IIdempotencyCompletion
	): Promise<IdempotencyKey> {
		const current = typeof record === 'string' ? await this.findById(record) : record;

		if (!current) {
			throw new NotFoundException('The idempotency key this request claimed no longer exists.');
		}

		if (current.status !== IdempotencyStatus.IN_PROGRESS) {
			return current;
		}

		const settled: IIdempotencyKey = {
			...current,
			status,
			responseStatus: completion.responseStatus ?? current.responseStatus,
			responseBody: completion.responseBody ?? current.responseBody,
			resourceType: completion.resourceType ?? current.resourceType,
			resourceId: completion.resourceId ?? current.resourceId
		};

		return this.typeOrmIdempotencyKeyRepository.save(
			this.typeOrmIdempotencyKeyRepository.create(settled as Partial<IdempotencyKey>)
		);
	}
}
