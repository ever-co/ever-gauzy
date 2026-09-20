import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IIdempotencyClaim,
	IIdempotencyCompletion,
	IIdempotencyKey,
	IIdempotencyStartInput,
	IPagination,
	IdempotencyOutcome,
	IdempotencyStatus
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
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
 * A stored key as an operator reads it.
 *
 * The stored response body is not part of it. A key row holds the answer the first attempt produced,
 * and that answer is the calling client's own data — an order, a refund, an instrument — so the
 * permission to release a key is not thereby a permission to read what the key answered. Everything
 * else on the row is diagnostic and is answered: the operation, the client's key, how far it got, and
 * what it points at.
 */
export type IdempotencyKeyView = Omit<IIdempotencyKey, 'responseBody'>;

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
 *
 * Storage is reached through the platform's dual-ORM CRUD path wherever that path can express the
 * call, so a deployment that switches `DB_ORM` runs the same kernel. Three calls it cannot carry go
 * to the TypeORM repository instead, and each says at the call site what it needs and why: the
 * claim's insert (whose lost race is read off the driver's own error), the sweep (which selects on a
 * range operator the converter does not translate) and the takeover (which takes a row lock).
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

		// The claim's insert stays on the repository, and the reason is the answer the caller gets when
		// it loses the race. The platform's CRUD write path cannot carry this call: `CrudService.create`
		// and `CrudService.save` catch every write failure and rethrow it as a `BadRequestException`
		// built from `toClientSafeError`, which is a client-facing message and a `400` rather than a
		// driver error — so `isUniqueViolation` below would stop recognizing the duplicate tuple and a
		// lost race would be reported as a failed write instead of resolving into the stored row. The
		// MikroORM arm of `CrudService.save` is an upsert besides, which merges into the row the race
		// was lost to instead of raising the violation the outcome is decided by. Porting this call
		// therefore needs a dual-ORM write that lets the driver's error through, which is a change in
		// `core/crud` rather than in this kernel, and it is reported as such rather than worked around
		// here.
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

		// The sweep stays on the repository, and the operator it needs is the reason. It selects on a
		// range — `expiresAt < now`, and `lockedAt < abandonedBefore` for the second rule — and the
		// dual-ORM surface cannot carry a range: `parseTypeORMFindToMikroOrm` translates `In` but sends
		// `LessThan` to the default branch of its `processFindOperator`, which warns and answers an
		// empty condition. Routed through that path the expiry predicate would vanish on one ORM and
		// the sweep would delete rows whose stored response is still replayable, which is the first of
		// the two eligibility rules above. `In` alone is not enough to move the call, and the deletes
		// below assert the same range, so the reads and the deletes travel together.
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
	 * The `LessThan` on the expiry is what makes the delete safe to lose a race to, and it is also why
	 * this call stays on the repository: see {@link purgeExpired} for what the dual-ORM path does with
	 * that operator.
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
	 * The criteria are plain values, so the lookup travels the platform's dual-ORM read path and
	 * answers the same row whichever ORM is deployed. It is spelled as a `find` bounded to one row
	 * rather than as the dual-ORM read-by-criteria, because a key that has never been presented is
	 * this service's ordinary answer — every first attempt is a miss — and the read-by-criteria
	 * answers a miss by raising `NotFoundException`.
	 *
	 * The tenant and the organization are passed exactly as the credential states them, `null`
	 * included. A `null` member is a predicate and not an omission under the platform's
	 * `TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR` (`null: 'sql-null'`), which is the setting that makes a
	 * criteria object mean the same thing on both ORMs, so the scoping of this lookup is unchanged by
	 * the port.
	 *
	 * @param scope The operation namespace.
	 * @param key The client-supplied key.
	 * @returns The row, or null when the key has never been presented.
	 */
	async findByKey(scope: string, key: string): Promise<IdempotencyKey | null> {
		const [record] = await this.find({
			where: {
				scope,
				key,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any,
			take: 1
		});

		return record ?? null;
	}

	/**
	 * Finds a row by id.
	 *
	 * The dual-ORM read by identifier answers a miss by raising, because a read by id is a `404` for
	 * every caller that reads one resource. A miss here is not a refusal: the settle below reads a row
	 * back to find out whether it is still there, and absence is one of the answers it acts on. The
	 * platform's refusal is therefore mapped back to `null` rather than allowed to escape.
	 *
	 * An absent id is mapped the same way, and that is deliberate rather than incidental: the platform
	 * refuses to look a row up by no id at all, because a criteria-less lookup answers an arbitrary row
	 * of the table — and this read feeds a write, so the arbitrary row would be the one settled.
	 *
	 * @param id The row id.
	 * @returns The row, or null.
	 */
	async findById(id: ID): Promise<IdempotencyKey | null> {
		try {
			return await this.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Reads one key of the caller's organization, as an operator sees it.
	 *
	 * The row is looked up through the same scope every other read of this service applies rather than
	 * by identifier alone, so a key belonging to another tenant is answered as absent. That is the
	 * difference between a refusal and a disclosure: a `404` says "no such key is stored", which is
	 * true for the caller, while a row of somebody else's would say that the key exists.
	 *
	 * @param id The row id.
	 * @returns The stored key, without the response it holds.
	 * @throws NotFoundException when no such key is stored for this caller.
	 */
	async findKeyOrFail(id: ID): Promise<IdempotencyKeyView> {
		const record = await this.listKeysById(id);

		if (!record) {
			throw new NotFoundException(`RESOURCE_NOT_FOUND: no idempotency key '${String(id)}' is stored.`);
		}

		return this.toKeyView(record);
	}

	/**
	 * Lists the keys of the caller's tenant and organization, newest first.
	 *
	 * The operator's view, and the reason it exists is that a release is only possible for a key whose
	 * identifier somebody can find: a stored key has no client-facing read of its own, so without this
	 * the release route would be reachable only by an operator who already knew the id from a log.
	 *
	 * The scope is the credential's and never the caller's, so one tenant can never read — or release —
	 * a key another tenant's retry is holding. The narrowing is deliberately narrow: the columns an
	 * operator actually searches by, because a wider filter on a table whose whole purpose is to answer
	 * one lookup would invite the scan the unique index exists to avoid.
	 *
	 * @param narrowing The columns to narrow by, and the page to answer.
	 * @returns One page of keys, newest first, without the responses they hold.
	 */
	async listKeys(narrowing: {
		scope?: string;
		key?: string;
		status?: IdempotencyStatus;
		resourceType?: string;
		take?: number;
		skip?: number;
	} = {}): Promise<IPagination<IdempotencyKeyView>> {
		const page = await this.findAll({
			where: this.keyCriteria(narrowing) as any,
			order: { createdAt: 'DESC' } as any,
			...(typeof narrowing.take === 'number' ? { take: narrowing.take } : {}),
			...(typeof narrowing.skip === 'number' ? { skip: narrowing.skip } : {})
		});

		return {
			...page,
			items: (page.items ?? []).map((record) => this.toKeyView(record))
		} as IPagination<IdempotencyKeyView>;
	}

	/**
	 * Releases a key, so the next attempt under it is a true first attempt.
	 *
	 * The row is removed rather than marked. A key that was marked released would still occupy the
	 * unique tuple, and the retry the operator is trying to unblock would then be refused as a reused
	 * key — which is the opposite of what releasing it is for. This is the one operation in the kernel
	 * that deletes, and it exists because a client that lost its key cannot do it for itself.
	 *
	 * **A claim that is still live is refused.** Deleting an `IN_PROGRESS` row whose lease has not
	 * gone stale would let the retry start a second run of work while the first one is still
	 * executing, and duplicating a side effect is exactly what the key exists to prevent. An operator
	 * who genuinely needs that must wait for the lease to expire — which happens on its own, in
	 * minutes — or delete the row in the store, deliberately and visibly.
	 *
	 * @param id The row id.
	 * @param policy Overrides for the stale-lock window.
	 * @returns The row that was removed.
	 * @throws NotFoundException when no such key is stored.
	 * @throws ApiException with `IDEMPOTENCY_IN_PROGRESS` while a live claim holds it.
	 */
	async release(id: ID, policy: IIdempotencyPolicy = {}): Promise<IdempotencyKeyView> {
		const record = await this.listKeysById(id);

		if (!record) {
			throw new NotFoundException(`RESOURCE_NOT_FOUND: no idempotency key '${String(id)}' is stored.`);
		}

		if (record.status === IdempotencyStatus.IN_PROGRESS && !this.isLockStale(record, policy)) {
			const heldForMs = this.heldForMs(record);
			const retryAfterMs = Math.max(
				0,
				(policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS) - heldForMs
			);

			throw new ApiException(
				HttpStatus.CONFLICT,
				ApiErrorCode.IDEMPOTENCY_IN_PROGRESS,
				'A request with this idempotency key is still in progress, so releasing it would let the work run twice.',
				{ scope: record.scope, retryAfterMs }
			);
		}

		await this.delete({ id } as any);

		return this.toKeyView(record);
	}

	/**
	 * The criteria every operator read of this resource is scoped by.
	 *
	 * The tenant and the organization come from the credential, and a member the caller did not state
	 * is left out of the criteria entirely rather than set to `undefined`: a key present with an
	 * undefined value is a criterion the ORM would have to interpret, and the two ORMs interpret it
	 * differently.
	 *
	 * @param narrowing What the caller stated.
	 * @returns The criteria.
	 */
	private keyCriteria(narrowing: {
		scope?: string;
		key?: string;
		status?: IdempotencyStatus;
		resourceType?: string;
	} = {}): Record<string, unknown> {
		const criteria: Record<string, unknown> = {};

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (tenantId) {
			criteria.tenantId = tenantId;
		}

		if (organizationId) {
			criteria.organizationId = organizationId;
		}

		if (narrowing.scope) {
			criteria.scope = narrowing.scope;
		}

		if (narrowing.key) {
			criteria.key = narrowing.key;
		}

		if (narrowing.status) {
			criteria.status = narrowing.status;
		}

		if (narrowing.resourceType) {
			criteria.resourceType = narrowing.resourceType;
		}

		return criteria;
	}

	/**
	 * Reads one row within the caller's scope.
	 *
	 * @param id The row id.
	 * @returns The row, or null when the caller has none by that id.
	 */
	private async listKeysById(id: ID): Promise<IdempotencyKey | null> {
		const rows = await this.find({ where: { ...this.keyCriteria(), id } as any, take: 1 });

		return rows?.[0] ?? null;
	}

	/**
	 * The projection an operator's read answers.
	 *
	 * The stored response is dropped here rather than at each surface, so both protocols answer the
	 * same columns by construction and a third caller cannot reintroduce the leak by forgetting to
	 * project.
	 *
	 * @param record The stored row.
	 * @returns The row without the response it holds.
	 */
	private toKeyView(record: IdempotencyKey): IdempotencyKeyView {
		const { responseBody: _storedResponse, ...view } = record as IdempotencyKey & { responseBody?: unknown };

		return view as IdempotencyKeyView;
	}

	/**
	 * Whether the claim on a row has been held long enough to be treated as abandoned.
	 *
	 * A row with no recorded lock is treated as abandoned: it was written by a build that did not
	 * stamp one, and refusing to ever release it would leave an operator with no way forward.
	 *
	 * @param record The stored row.
	 * @param policy Overrides for the stale-lock window.
	 * @returns True when the lease has gone stale.
	 */
	private isLockStale(record: Pick<IdempotencyKey, 'lockedAt'>, policy: IIdempotencyPolicy = {}): boolean {
		if (!record.lockedAt) {
			return true;
		}

		return this.heldForMs(record) >= (policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS);
	}

	/**
	 * How long ago a claim was taken.
	 *
	 * @param record The stored row.
	 * @returns The age of the claim in milliseconds, or zero when none was stamped.
	 */
	private heldForMs(record: Pick<IdempotencyKey, 'lockedAt'>): number {
		if (!record.lockedAt) {
			return 0;
		}

		const taken = new Date(record.lockedAt).getTime();

		return Number.isFinite(taken) ? Math.max(0, Date.now() - taken) : 0;
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
	 * The lock is the reason this call stays on the repository: a row lock is a database feature
	 * rather than an ORM one, and the platform's cross-ORM surface carries neither half of it. The
	 * dual-ORM query builder offers no `setLock` — `IQueryBuilder` has no such member — and
	 * `CrudService` exposes no transaction for a MikroORM deployment to take the lock inside, so a
	 * port would have to give up the lock and with it the guarantee that only one of two concurrent
	 * takeovers wins. What a store that cannot lock does instead is unchanged and is the branch below:
	 * the surrounding transaction is the lock.
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
	 * The write travels the platform's dual-ORM save, because the row it writes already exists and is
	 * addressed by its primary key alone: no criterion beyond the id is involved, so nothing about the
	 * call needs an operator or a lock. Unlike the claim's insert, no answer of this kernel is read off
	 * the error a failed write raises — the interceptor logs a settle that could not be recorded and
	 * still returns the response the work produced — so the platform's own client-safe error is the
	 * right thing for a failure here to surface as.
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

		return this.save(settled as unknown as IdempotencyKey);
	}
}
