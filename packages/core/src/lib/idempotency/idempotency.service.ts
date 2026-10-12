import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { In, LessThan } from 'typeorm';
import { LockMode } from '@mikro-orm/core';
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
import { MultiORMEnum } from '../core/utils';
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
 * not executed again. The insert is the lock — the unique tuple `(tenantId, organizationId, scope,
 * key)` is what makes two concurrent identical requests resolve to exactly one owner, with no lock
 * table and no cooperation from the caller.
 *
 * The service answers with outcomes rather than exceptions, because what a client should be told
 * (`409` for in flight, `422` for a reused key, the stored response for a replay) is a transport
 * decision the caller owns.
 *
 * Storage is reached through the platform's dual-ORM CRUD path wherever that path can express the
 * call, so a deployment that switches `DB_ORM` runs the same kernel. The calls it cannot carry are
 * written once per ORM instead — never on one ORM's repository alone — and each says at the call site
 * what it needs and why: the claim's insert (whose lost race is read off the driver's own error), the
 * sweep and the expired-row clear (whose deletes must surface a store failure as one) and the takeover
 * (which takes a row lock). Writing those on the TypeORM repository alone is what made every
 * `@Idempotent` route fail under `DB_ORM=mikro-orm`: the columns they name are `@MultiORMColumn`s,
 * which exist in only one ORM's metadata at a time.
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

		// The claim's insert stays off the platform's CRUD write path, and the reason is the answer the
		// caller gets when it loses the race. `CrudService.create` and `CrudService.save` catch every
		// write failure and rethrow it as a `BadRequestException` built from `toClientSafeError`, which
		// is a client-facing message and a `400` rather than a driver error — so `isUniqueViolation`
		// below would stop recognizing the duplicate tuple and a lost race would be reported as a failed
		// write instead of resolving into the stored row. The MikroORM arm of `CrudService.save` is no way
		// round that either: it loads the row a payload's primary key names and `assign()`s the payload
		// onto it, and builds a payload that names none — a claim — as `create()` builds a new row, so a
		// lost race surfaces from its flush and reaches the caller as the same `400`.
		//
		// It does **not** follow that the call may stay on the TypeORM repository, which is where it was
		// and what made every `@Idempotent` route fail under `DB_ORM=mikro-orm`: `key`, `scope`,
		// `requestHash`, `expiresAt` and `lockedAt` are `@MultiORMColumn`s, so on that ORM they are not
		// in TypeORM's metadata at all. The write is therefore branched on the configured ORM, and each
		// arm is a native insert that lets the driver's error through — see {@link insertClaim}.
		const values: Partial<IdempotencyKey> = {
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
		};

		try {
			const record = await this.insertClaim(values, now);

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
				//
				// That is the only way here now that the unique tuple is scoped exactly as this read is
				// (`ScopeIdempotencyKeyByTenant1791000000557`). While the index carried no tenant, a caller
				// of another tenant with no organization selected landed here too — refused by a row it
				// may not see, on every attempt — and was answered with this driver error.
				throw error;
			}

			return this.resolveExisting(raced, input, policy);
		}
	}

	/**
	 * Inserts the claim row, on whichever ORM the installation runs.
	 *
	 * Both arms are native writes rather than ORM persistence: the outcome of a claim is read off the
	 * driver's unique violation, and a write path that translates or swallows that error takes the
	 * kernel's decision away from it.
	 *
	 * The MikroORM arm states more than the TypeORM one, because the two ORMs disagree about where a
	 * value comes from:
	 *
	 * - **The tenant and the organization travel as the relations, not as `tenantId`/`organizationId`.**
	 *   Those two are `relationId` columns, which MikroORM maps with `persist: false` (`column.helper.ts`),
	 *   so `em.insert` drops them without a word and the row would be stored with no scope at all —
	 *   invisible to the scoped read that has to find it, and colliding with every other unscoped key.
	 * - **The identifier, the timestamps and the two flags are stated rather than defaulted.** The id is
	 *   a column default only on Postgres, and `em.insert` runs none of the `onCreate` hooks a flush would.
	 *
	 * @param values The claim's columns.
	 * @param now The moment the claim is taken.
	 * @returns The stored row.
	 */
	private async insertClaim(values: Partial<IdempotencyKey>, now: Date): Promise<IdempotencyKey> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			const id = randomUUID() as ID;
			const { tenantId, organizationId, ...columns } = values;

			await this.mikroOrmIdempotencyKeyRepository.getEntityManager().insert(IdempotencyKey, {
				...columns,
				id,
				tenant: tenantId ?? null,
				organization: organizationId ?? null,
				createdAt: now,
				updatedAt: now,
				isActive: true,
				isArchived: false
			} as any);

			// Read back through the dual-ORM path rather than trusting the inserted object, so the row the
			// caller settles later is the row the store holds.
			return (await this.findById(id)) ?? ({ ...values, id, createdAt: now, updatedAt: now } as IdempotencyKey);
		}

		return this.typeOrmIdempotencyKeyRepository.save(this.typeOrmIdempotencyKeyRepository.create(values));
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
	 * **A row is only cleared once nothing can still be working under it.** An expired row that a
	 * live claim still owns *is* that claim's lease, and deleting it would hand one key to two
	 * writers — the single outcome the key exists to prevent, and the rule `purgeExpired` applies to
	 * the same row. The request is told the work is in flight instead, and the expiry is renewed by
	 * the takeover once the lease really has gone stale.
	 *
	 * @param input The scope, key and request hash the caller presented.
	 * @param policy Overrides for the retention and stale-lock windows.
	 * @returns A claim the caller owns, or the stored response, or the reason it must wait.
	 */
	async claim(input: IIdempotencyStartInput, policy: IIdempotencyPolicy = {}): Promise<IIdempotencyClaim> {
		const existing = await this.findByKey(input.scope, input.key);

		if (existing && this.isExpired(existing) && !this.isLeaseLive(existing, policy)) {
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

		// The sweep is written once per ORM rather than on one ORM's repository. Every column it selects
		// on is a `@MultiORMColumn` and therefore absent from TypeORM's metadata under
		// `DB_ORM=mikro-orm`, so a sweep written on the TypeORM repository alone failed on its first read
		// there and the cleanup job never deleted a row. Nor does it go through the dual-ORM surface,
		// although the converter now carries the range it needs: `CrudService.delete` answers every
		// failure as `NotFoundException`, and a sweep whose store failed must say so rather than report
		// that a row was not found. Both arms assert the identical predicates — MikroORM spells
		// `LessThan` and `In` as `$lt` and `$in` — and both assert them twice, once to pick the rows and
		// once to delete them.
		const terminalStatuses = [IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED];

		if (this.ormType === MultiORMEnum.MikroORM) {
			return this.purgeExpiredOnMikroOrm(limit, now, abandonedBefore, terminalStatuses);
		}

		const terminal = await this.typeOrmIdempotencyKeyRepository.find({
			where: {
				expiresAt: LessThan(now),
				status: In(terminalStatuses)
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
				status: In(terminalStatuses)
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
	 * The MikroORM arm of {@link purgeExpired}: the same two rules, the same bound, and the same
	 * predicates asserted again on the delete.
	 *
	 * @param limit The maximum number of rows to delete in one sweep.
	 * @param now The moment the sweep is decided against.
	 * @param abandonedBefore A lock taken before this is abandoned.
	 * @param terminalStatuses The statuses a settled row carries.
	 * @returns How many rows were selected for deletion, which is what the TypeORM arm reports too.
	 */
	private async purgeExpiredOnMikroOrm(
		limit: number,
		now: Date,
		abandonedBefore: Date,
		terminalStatuses: IdempotencyStatus[]
	): Promise<number> {
		const em = this.mikroOrmIdempotencyKeyRepository.getEntityManager();

		const terminal = await em.find(
			IdempotencyKey,
			{ expiresAt: { $lt: now }, status: { $in: terminalStatuses } } as any,
			{ fields: ['id'] as any, limit }
		);

		const remaining = limit - terminal.length;
		const abandoned =
			remaining > 0
				? await em.find(
						IdempotencyKey,
						{
							expiresAt: { $lt: now },
							status: IdempotencyStatus.IN_PROGRESS,
							lockedAt: { $lt: abandonedBefore }
						} as any,
						{ fields: ['id'] as any, limit: remaining }
				  )
				: [];

		const terminalIds = terminal.map((row) => row.id);
		const abandonedIds = abandoned.map((row) => row.id);

		if (terminalIds.length) {
			await em.nativeDelete(IdempotencyKey, {
				id: { $in: terminalIds },
				expiresAt: { $lt: now },
				status: { $in: terminalStatuses }
			} as any);
		}

		if (abandonedIds.length) {
			await em.nativeDelete(IdempotencyKey, {
				id: { $in: abandonedIds },
				expiresAt: { $lt: now },
				status: IdempotencyStatus.IN_PROGRESS,
				lockedAt: { $lt: abandonedBefore }
			} as any);
		}

		return terminalIds.length + abandonedIds.length;
	}

	/**
	 * Clears one expired row, but only while it is still expired.
	 *
	 * The range on the expiry is what makes the delete safe to lose a race to, and it is stated per ORM
	 * for the reason {@link purgeExpired} gives.
	 *
	 * @param id The row id.
	 */
	private async clearExpired(id: ID): Promise<void> {
		const now = new Date();

		if (this.ormType === MultiORMEnum.MikroORM) {
			await this.mikroOrmIdempotencyKeyRepository
				.getEntityManager()
				.nativeDelete(IdempotencyKey, { id, expiresAt: { $lt: now } } as any);

			return;
		}

		await this.typeOrmIdempotencyKeyRepository.delete({
			id,
			expiresAt: LessThan(now)
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
	 * **The unique index is scoped exactly as this read is, and the two have to agree.** It was not:
	 * `UQ_idempotency_org_scope_key` folded the organization but carried no tenant, so two tenants
	 * whose callers had no organization selected shared one tuple. This read answered "no such key" to
	 * the second tenant, whose insert was then refused by a row it may not see. The index became
	 * `(tenant, organization, scope, key)`, each nullable member folded to the zero uuid, in
	 * `ScopeIdempotencyKeyByTenant1791000000557`.
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
	 * Whether another request may still be working under a stored row.
	 *
	 * This is the takeover decision in one place, because two callers depend on it agreeing with
	 * itself: {@link claim} must not clear a row a live lease owns, and {@link resolveExisting} takes
	 * a row over exactly when no live lease owns it. A row is a lease only while it is `IN_PROGRESS`
	 * — a settled row holds a stored response rather than an owner — and its holder is presumed alive
	 * until the lock has been held longer than the stale-lock window. A row with no recorded lock
	 * counts as abandoned, which is the same reading {@link isLockStale} takes for the operator's
	 * release: it was written by a build that did not stamp one.
	 *
	 * @param record The stored row.
	 * @param policy Overrides for the stale-lock window.
	 * @returns True while the row is a claim another request may still be executing.
	 */
	private isLeaseLive(
		record: Pick<IdempotencyKey, 'status' | 'lockedAt'>,
		policy: IIdempotencyPolicy = {}
	): boolean {
		if (record.status !== IdempotencyStatus.IN_PROGRESS || !record.lockedAt) {
			return false;
		}

		return this.heldForMs(record) <= (policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS);
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
					// A row that settled without recording a status is answered by what the row itself says
					// it was. `200` for every such row replayed a stored *failure* as a success — a request
					// the server refused came back as one it accepted — and `fail()` takes its status as
					// optional, so nothing stops a caller from settling one that way. A failure with no
					// recorded status is answered as a failure the platform could not describe is anywhere
					// else.
					status:
						existing.responseStatus ??
						(existing.status === IdempotencyStatus.FAILED ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.OK),
					body: existing.responseBody
				}
			};
		}

		const staleLockMs = policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS;
		const lockedAt = existing.lockedAt ? new Date(existing.lockedAt).getTime() : 0;
		const lockAgeMs = Date.now() - lockedAt;

		// The takeover happens exactly when no live lease owns the row — the same predicate `claim`
		// consults before it clears an expired one, so the two cannot drift into disagreeing about
		// whether a key is free.
		if (!this.isLeaseLive(existing, policy)) {
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
	 * The lock is the reason this call stays off the platform's cross-ORM surface: a row lock is a
	 * database feature rather than an ORM one, and that surface carries neither half of it. The
	 * dual-ORM query builder offers no `setLock` — `IQueryBuilder` has no such member — and
	 * `CrudService` exposes no transaction to take the lock inside. Each ORM is therefore driven
	 * directly — the TypeORM repository alone failed under `DB_ORM=mikro-orm`, where this entity's
	 * columns are not in TypeORM's metadata — and both arms make the same decision: read the row under
	 * `FOR UPDATE` where the dialect has one, re-check the staleness, and write the takeover inside the
	 * same transaction. On the embedded dialects there is no row lock to take and the surrounding
	 * transaction is the lock.
	 *
	 * @param id The row id.
	 * @param policy Overrides for the retention window.
	 * @returns The re-claimed row, or null when the claim turned out to be live after all.
	 */
	private async takeOver(id: ID, policy: IIdempotencyPolicy): Promise<IdempotencyKey | null> {
		const staleLockMs = policy.staleLockMs ?? IdempotencyService.DEFAULT_STALE_LOCK_MS;
		const retentionMs = policy.retentionMs ?? IdempotencyService.DEFAULT_RETENTION_MS;

		if (this.ormType === MultiORMEnum.MikroORM) {
			return this.mikroOrmIdempotencyKeyRepository.getEntityManager().transactional(async (em) => {
				const current = await em.findOne(
					IdempotencyKey,
					{ id, status: IdempotencyStatus.IN_PROGRESS } as any,
					isPostgres() || isMySQL() ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {}
				);

				if (!current || !this.renewAbandonedLease(current, staleLockMs, retentionMs)) {
					return null;
				}

				await em.flush();

				return current;
			});
		}

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

			if (!current || !this.renewAbandonedLease(current, staleLockMs, retentionMs)) {
				return null;
			}

			return manager.save(IdempotencyKey, current);
		});
	}

	/**
	 * The takeover decision both arms of {@link takeOver} make on the row they read under the lock.
	 *
	 * @param current The locked row.
	 * @param staleLockMs How long a claim may be held before it is abandoned.
	 * @param retentionMs How long the renewed claim stays replayable.
	 * @returns True when the lease was abandoned and has been renewed on the row, for the caller to write.
	 */
	private renewAbandonedLease(current: IdempotencyKey, staleLockMs: number, retentionMs: number): boolean {
		const lockedAt = current.lockedAt ? new Date(current.lockedAt).getTime() : 0;

		if (Date.now() - lockedAt <= staleLockMs) {
			// The holder is alive; the caller must wait rather than duplicate the work.
			return false;
		}

		const now = new Date();

		current.lockedAt = now;
		current.expiresAt = new Date(now.getTime() + retentionMs);

		return true;
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
