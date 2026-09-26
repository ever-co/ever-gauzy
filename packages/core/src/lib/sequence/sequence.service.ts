import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { EntityManager, LessThan } from 'typeorm';
import {
	EntityData,
	EntityManager as MikroOrmEntityManager,
	FilterQuery,
	LockMode,
	ReferenceKind
} from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import { IAllocatedNumber, ID, ISequence, IdempotencyOutcome, JsonData, SequenceResetPolicy } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { MultiORMEnum } from '../core/utils';
import { readAffectedRows } from '../database/database.helper';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { stableStringify } from '../idempotency/idempotency.policy';
import { Sequence } from './sequence.entity';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

/**
 * The idempotency namespace an allocation claims the caller's key under.
 *
 * One namespace is enough: what makes two allocations the same allocation is the series and the
 * channel, and those are carried in the request hash, so a key presented for a second series is
 * refused as a reused key rather than answered with another series' number.
 */
const ALLOCATION_SCOPE = 'sequence.allocate';

/**
 * The manager a statement on the series row goes through: TypeORM's, or MikroORM's.
 *
 * Which one it is follows from the configured ORM, and the service only ever hands a statement the
 * manager of the ORM it dispatches that statement to.
 */
type SeriesManager = EntityManager | MikroOrmEntityManager;

/**
 * The `relationId` mirrors of the series table, and the relation MikroORM writes each one through.
 *
 * `@MultiORMColumn({ relationId: true })` maps a mirror with `persist: false` under MikroORM
 * (`column.helper.ts`), so an insert that names the mirror is one MikroORM is free to drop, and a series
 * stored with no scope is one no scoped allocation can ever find. Reads name the mirror, which MikroORM
 * hydrates from its column and translates to that column in a criterion.
 */
const MIKRO_ORM_RELATION_OF_MIRROR: Readonly<Record<string, string>> = {
	tenantId: 'tenant',
	organizationId: 'organization'
};

/**
 * Reads one series through MikroORM, from the table rather than from an identity map.
 *
 * `disableIdentityMap` reads by a query even when a context holds the row — the counter an allocation
 * decides on must be the stored one — and runs the read on a fork, which keeps the transaction it is
 * made in and needs no request context. An `undefined` member of the criterion is left out and a `null`
 * one is `IS NULL`, which is how the TypeORM arm's connection reads the same criterion.
 *
 * @param em The manager, or a transaction's.
 * @param where The criterion.
 * @param lock Whether to read `FOR UPDATE`; only ever true inside a transaction on Postgres or MySQL.
 * @returns The series' columns, or null.
 */
async function readSeriesOnMikroOrm(
	em: MikroOrmEntityManager,
	where: Record<string, unknown>,
	lock: boolean
): Promise<Sequence | null> {
	const criteria = Object.fromEntries(Object.entries(where).filter(([, value]) => value !== undefined));

	const series = await em.findOne(Sequence, criteria as FilterQuery<Sequence>, {
		disableIdentityMap: true,
		...(lock ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {})
	});

	if (!series) {
		return null;
	}

	// The row's columns and nothing else, as the TypeORM arm answers them: MikroORM hydrates the scope as
	// relation references, which are not the row and do not serialize as it. The `relationId` mirrors are
	// scalar properties hydrated from their columns, so the scope is answered as `tenantId` and
	// `organizationId`.
	const columns = em
		.getMetadata()
		.get<Sequence>(Sequence.name)
		.props.filter((prop) => prop.kind === ReferenceKind.SCALAR && series[prop.name] !== undefined)
		.map((prop) => [prop.name, series[prop.name]]);

	return Object.fromEntries(columns) as Sequence;
}

/**
 * Allocates human-facing document numbers from a series.
 *
 * Every allocation is serialized against the series row so two concurrent writers can never be
 * handed the same value. Where the dialect supports row locks the read takes one — `FOR UPDATE` on
 * Postgres and MySQL, inside the allocation's own transaction. Where it does not, the guarantee is
 * carried by the write instead of by the read: the counter is moved with a statement predicated on
 * the state that was read, so an allocator whose series moved underneath it changes nothing, reads
 * again, and takes the next number rather than repeating one.
 *
 * That second half is what the embedded dialects actually need, because "the embedded dialect
 * serialises writers" is not true of how the platform reaches it. `sqlite` and `better-sqlite3` both
 * run on TypeORM's better-sqlite3 driver, which holds a single query runner per data source: a second
 * transaction opened while a first is still running does not wait for it but becomes a `SAVEPOINT`
 * inside it, so two allocations' reads and writes interleave on one connection, and each can read the
 * counter before the other has written it. The conditional write turns that into "allocations retry
 * under contention" instead of "allocations repeat under contention". (Two processes against one file
 * are a different case: SQLite's own file lock refuses the second writer with `SQLITE_BUSY`, which
 * fails that allocation rather than repeating a number.)
 *
 * An allocation may also be claimed under an idempotency key, which is what makes a retried request
 * cost the series nothing: the retry is answered with the number the first attempt allocated instead
 * of consuming a second one.
 *
 * 🛑 **Every read and write of the series row has an arm per ORM, and it is the configured ORM's.** The
 * series' columns are `@MultiORMColumn`s, which register with the active ORM alone, so under
 * `DB_ORM=mikro-orm` TypeORM knows the entity as a skeleton and every lookup, lock and swap written on the
 * TypeORM repository failed there — no document could be numbered on that ORM. The decisions — the
 * fallback from a channel series to the organization's, the restart, the compare-and-swap and its retry —
 * are written once and made the same way on both; only the four statements under them (the transaction,
 * the locked read, the swap and the read-back) are the ORM's own. The TypeORM statement of each is the
 * one it always was.
 */
@Injectable()
export class SequenceService extends CrudService<Sequence> {
	/**
	 * How many times an allocation reads the series before it gives up on a contended counter.
	 *
	 * A lost swap means another allocation was handed a number between this one's read and its write,
	 * which is the ordinary outcome of contention rather than a fault, and every attempt after the
	 * first is preceded by a short jittered pause so that contenders stop reading in lockstep. The
	 * budget is the number of allocations that may overtake this one before it reports a conflict
	 * rather than spinning. On Postgres and MySQL the row lock means the swap never loses at all.
	 */
	static readonly ALLOCATION_ATTEMPTS = 10;

	/** The upper bound, per attempt already made, of the pause before an allocation reads again. */
	static readonly ALLOCATION_RETRY_JITTER_MS = 5;

	constructor(
		readonly typeOrmSequenceRepository: TypeOrmSequenceRepository,
		readonly mikroOrmSequenceRepository: MikroOrmSequenceRepository,
		readonly idempotencyService: IdempotencyService
	) {
		super(typeOrmSequenceRepository, mikroOrmSequenceRepository);
	}

	/**
	 * Finds the series a key resolves to, applying the per-channel fallback.
	 *
	 * A channel-scoped series wins over the organization-wide one; an installation that numbers
	 * documents per channel therefore declares a series per channel and needs no second key.
	 *
	 * @param key The series key.
	 * @param channelId The channel the document belongs to, when the caller knows it.
	 * @returns The series row.
	 * @throws NotFoundException when neither a channel series nor an organization series exists.
	 */
	async findSeries(key: string, channelId?: ID): Promise<Sequence> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (channelId) {
			const channelSeries = await this.findOneSeries({ key, channelId, tenantId, organizationId });

			if (channelSeries) {
				return channelSeries;
			}
		}

		const organizationSeries = await this.findOneSeries({ key, channelId: null, tenantId, organizationId });

		if (!organizationSeries) {
			throw new NotFoundException(
				`No numbering series is configured for "${key}". Create one before requesting a number.`
			);
		}

		return organizationSeries;
	}

	/**
	 * Allocates the next number in a series.
	 *
	 * @param key The series key.
	 * @param options.channelId Channel the document belongs to.
	 * @param options.at Moment the number is allocated at; defaults to now. Supplied by tests and by
	 * imports that replay historical documents.
	 * @param options.idempotencyKey Key the caller retries under, when it has one. A second allocation
	 * presented under the same key is answered with the number the first one allocated and costs the
	 * series nothing, which is what keeps one logical document from being numbered twice.
	 * @returns The allocated number, formatted and raw.
	 * @throws ConflictException when the key is held by an allocation still in flight, was presented
	 * for a different request, or settled without a number to replay.
	 *
	 * An allocation that throws leaves its claim in progress rather than settling it as failed: what
	 * fails here is usually the database rather than the request, and a claim whose lock goes stale is
	 * taken over by the retry, where a settled failure would be replayed for the whole retention
	 * window.
	 */
	async allocate(
		key: string,
		options: { channelId?: ID; at?: Date; idempotencyKey?: string } = {}
	): Promise<IAllocatedNumber> {
		const at = options.at ?? new Date();
		const idempotencyKey = options.idempotencyKey?.trim();

		// The claim is taken before the series is locked, so a retry that arrives while the first
		// attempt is still allocating is told to come back rather than handed a second number.
		const claim = idempotencyKey
			? await this.idempotencyService.claim({
					scope: ALLOCATION_SCOPE,
					key: idempotencyKey,
					requestHash: this.requestHash(key, options.channelId),
					resourceType: 'sequence'
			  })
			: undefined;

		if (claim?.outcome === IdempotencyOutcome.REPLAYED) {
			const replayed = claim.response?.body as unknown as IAllocatedNumber | undefined;

			if (!replayed) {
				// A key that settled without a response — a failure recorded with nothing to replay.
				// Allocating afresh would number the document twice, which is the outcome the key
				// exists to prevent, so the caller is refused instead.
				throw new ConflictException(
					`IDEMPOTENCY_FAILED_PREVIOUSLY: the allocation claimed under "${idempotencyKey}" ` +
						`settled without a number to replay.`
				);
			}

			return replayed;
		}

		if (claim?.outcome === IdempotencyOutcome.REUSED_KEY) {
			throw new ConflictException(
				`IDEMPOTENCY_KEY_REUSED: "${idempotencyKey}" was already presented for another allocation.`
			);
		}

		if (claim?.outcome === IdempotencyOutcome.IN_FLIGHT) {
			throw new ConflictException(
				`IDEMPOTENCY_IN_PROGRESS: another request holds "${idempotencyKey}" and is still allocating.`
			);
		}

		let seriesId: ID | undefined;
		let allocated: IAllocatedNumber | undefined;

		// 🛑 **The allocation is a compare-and-swap, and the retry around it is what makes the
		// guarantee hold on four dialects rather than on two.** Postgres and MySQL serialise two
		// allocators with `FOR UPDATE`, so the swap there never loses. The embedded dialects have no row
		// lock, and their transactions do not serialise either: TypeORM's better-sqlite3 driver nests a
		// second transaction inside the first as a savepoint on the one connection it holds, so two
		// allocations can both read `nextValue` before either writes it — and the unconditional `save`
		// this replaced then handed the same number to both while the series advanced only once.
		//
		// Predicating the update on the state that was read turns that into one rule that holds
		// everywhere: the counter moves only from the value this allocator saw, so a second allocator
		// that saw the same value changes nothing and reads again. Nobody is handed a number that was
		// handed out already, on any dialect, with or without a lock.
		for (let attempt = 1; attempt <= SequenceService.ALLOCATION_ATTEMPTS && !allocated; attempt += 1) {
			if (attempt > 1) {
				await this.pauseBeforeRetry(attempt - 1);
			}

			allocated = await this.seriesTransaction(async (manager) => {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();

				const scope = { key, tenantId, organizationId } as any;

				// Prefer the channel series; fall back to the organization series.
				let series = options.channelId
					? await this.lockSeries(manager, { ...scope, channelId: options.channelId })
					: null;

				series = series ?? (await this.lockSeries(manager, { ...scope, channelId: null }));

				if (!series) {
					throw new NotFoundException(
						`No numbering series is configured for "${key}". Create one before requesting a number.`
					);
				}

				if (series.isActive === false) {
					throw new BadRequestException(`The numbering series "${key}" is not active.`);
				}

				// What the row held when it was read: the swap is predicated on it, so it has to be taken
				// before the restart rewinds the counter or the first contact records a period.
				const observedValue = series.nextValue;
				const observedPeriod = series.lastResetAt;

				const restarted = this.applyResetIfDue(series, at);

				if (restarted) {
					// Stamped before the write rather than after it, so the rewind and the record of when the
					// period started are one statement: a row carrying one without the other would restart
					// twice inside one period. At the whole second: see {@link restartStamp}.
					series.lastResetAt = this.restartStamp(at);
				}

				const allocatedValue = series.nextValue;

				series.nextValue = allocatedValue + (series.step ?? 1);

				const swapped = await this.swapCounter(manager, series, {
					nextValue: observedValue,
					restartedInto: restarted ? this.currentPeriodStart(series.resetPolicy, at) : undefined,
					periodChanged: series.lastResetAt !== observedPeriod
				});

				if (!swapped) {
					// Another allocator moved the series between the read and this statement. Nothing was
					// written, so nothing has to be undone; the loop reads the series again.
					return undefined;
				}

				seriesId = series.id;

				return {
					formatted: this.format(series, allocatedValue),
					value: allocatedValue,
					key: series.key
				};
			});
		}

		if (!allocated) {
			throw new ConflictException(
				`${ApiErrorCode.CONCURRENT_MODIFICATION}: the numbering series "${key}" was moved by another allocation ` +
					`${SequenceService.ALLOCATION_ATTEMPTS} times in a row, so no number was handed out. Retry the request.`
			);
		}

		if (claim) {
			// Recorded once the number is committed, so an allocation that failed leaves the key
			// claimable rather than replaying a number that was never handed out.
			await this.idempotencyService.complete(claim.record, {
				responseStatus: 200,
				responseBody: allocated as unknown as JsonData,
				resourceType: 'sequence',
				...(seriesId ? { resourceId: seriesId } : {})
			});
		}

		return allocated;
	}

	/**
	 * Creates a series when it does not exist and returns it.
	 *
	 * Idempotent by design: an installation that seeds its series on every boot must not create a
	 * second series for the same key and scope, because that would restart numbering.
	 *
	 * @param input The series to ensure.
	 * @returns The existing or newly created series.
	 */
	async ensure(input: Partial<ISequence> & { key: string }): Promise<ISequence> {
		// The scope the caller states wins over the request's. A seed run, a migration and a test
		// execute outside a request, where the context carries no scope at all, and a series created
		// attached to nobody is a series no scoped allocation can ever find — so the two are resolved
		// once here and used for both the lookup and the insert, which is what keeps `ensure`
		// idempotent in the scope the caller named.
		const tenantId = input.tenantId ?? RequestContext.currentTenantId();
		const organizationId = input.organizationId ?? RequestContext.currentOrganizationId();

		const existing = await this.findOneSeries({
			key: input.key,
			channelId: input.channelId ?? null,
			tenantId,
			organizationId
		});

		if (existing) {
			return existing;
		}

		return this.insertSeries({
			...input,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {}),
			padding: input.padding ?? 6,
			step: input.step ?? 1,
			nextValue: input.nextValue ?? 1,
			resetPolicy: input.resetPolicy ?? SequenceResetPolicy.NEVER
		} as Partial<Sequence>);
	}

	/**
	 * Lists the numbering series of the caller's organization.
	 *
	 * The read is scoped the way the allocation is scoped: the tenant and the organization are read
	 * from the credential and never from the caller, so one organization's administrator is never
	 * handed another organization's counters. The order is the series' own — by key — because that is
	 * the order an operator reads a numbering configuration in.
	 *
	 * @param filter Optional narrowing by series key and by channel.
	 * @returns The series of the caller's organization, by key.
	 */
	async listSeries(filter: { key?: string; channelId?: ID } = {}): Promise<Sequence[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const series: Sequence[] = await this.find({
			where: {
				...(filter.key ? { key: filter.key } : {}),
				...(filter.channelId ? { channelId: filter.channelId } : {}),
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as any,
			order: { key: 'ASC' }
		} as any);

		return series ?? [];
	}

	/**
	 * Reads one series of the caller's organization.
	 *
	 * @param id The series id.
	 * @returns The series.
	 * @throws NotFoundException when no series of that id is in the caller's scope — the same answer a
	 * series that does not exist gets, because a caller is never told that another organization holds
	 * the identifier it asked about.
	 */
	async findSeriesOrFail(id: ID): Promise<Sequence> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const series: Sequence[] = await this.find({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as any
		} as any);

		if (!series?.length) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: no numbering series '${String(id)}' exists in this organization.`
			);
		}

		return series[0];
	}

	/**
	 * Creates a series.
	 *
	 * **`key` and `channelId` are the series' identity, and both are stated once.** Together they are
	 * what an allocation resolves the series by, and the table's two partial unique indexes make a
	 * second live row for one pair impossible — which is what stops one key from having two counters.
	 * The lookup below is the readable answer to that collision; the indexes are the guarantee, because
	 * two concurrent creates can both pass a check and only one can pass an index.
	 *
	 * **`nextValue` is the one state member a create accepts, and it is accepted deliberately.** An
	 * installation that adopts numbering an external system has already stepped states the counter the
	 * new series must continue from, and `ensure` takes it for the same reason. No later write accepts
	 * it: re-stating a counter that documents have been numbered from is how an installation comes to
	 * issue a number twice.
	 *
	 * @param input The series as the caller states it.
	 * @returns The stored series.
	 * @throws BadRequestException when the key is absent, or when the scope already holds a series for
	 * the key and channel.
	 */
	async createSeries(input: Partial<ISequence> & { key: string }): Promise<Sequence> {
		const key = input?.key ? String(input.key).trim() : '';

		if (!key) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a series is stated with a key — the word every allocation resolves it by — and none was presented.`
			);
		}

		const channelId = input.channelId ?? null;
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const scope = { ...(tenantId ? { tenantId } : {}), ...(organizationId ? { organizationId } : {}) };

		// Read through the reader the allocator locks through, so "the series of this key in this scope"
		// is one statement rather than two: the channel is the member that has to be asked for as
		// `IS NULL`, because `channelId = NULL` matches nothing in any dialect. This read runs outside a
		// transaction, so that reader takes no lock here — TypeORM refuses one outside a transaction —
		// which is why the unique indexes carry the guarantee.
		const existing = await this.lockSeries(this.seriesManager, {
			key,
			channelId,
			...scope
		});

		if (existing) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: a numbering series for '${key}' ${
					channelId ? 'on this channel' : 'organization-wide'
				} already exists. Change that series rather than creating a second one for the same key, because a second counter issues numbers the first has already issued.`
			);
		}

		// The same write path `ensure` uses, so a series an operator creates and a series a seed run
		// ensures are the same row shape in the same table. **The members are stated one by one rather
		// than spread from the payload**, because a spread would let a body carrying an `id` — or a
		// `deletedAt`, or a `lastResetAt` — reach a row this write is not allowed to touch: with an id
		// the save becomes an update, and an id naming another organization's series is the one thing a
		// scoped create must never reach.
		return this.insertSeries({
			key,
			channelId: channelId as any,
			prefix: input.prefix,
			// Stated rather than left to the column's own default: the delivered column defaults to `1`
			// and the documented width is `6`, so relying on the default would create a series that
			// formats numbers differently from every series the seeder creates.
			padding: input.padding ?? 6,
			nextValue: input.nextValue ?? 1,
			step: input.step ?? 1,
			resetPolicy: input.resetPolicy ?? SequenceResetPolicy.NEVER,
			description: input.description,
			...scope
		} as Partial<Sequence>);
	}

	/**
	 * Changes the configuration of a series.
	 *
	 * **What a caller may change is the shape of the numbers the series produces** — its prefix, its
	 * width, its step, its restart policy, the note kept beside it and whether it is active at all.
	 * **What a caller may not change is what the series has already counted**: `nextValue` is the value
	 * the next document will be numbered with and `lastResetAt` is the period the series last restarted
	 * in. Neither is a column an edit writes, and a body that states one is refused by name rather than
	 * ignored, because a caller that believes it edited a counter has a bug it would otherwise never
	 * see — and because a counter written from outside the allocator is how two documents come to carry
	 * one number.
	 *
	 * **`key` and `channelId` are refused for the other half of the same reason.** They are the
	 * series' identity and the scope of its counter: renaming the key leaves the counter reachable
	 * under no name at all, and moving the channel hands one sales surface's numbers to another. An
	 * installation that needs a series under another key or scope creates it there and lets the
	 * existing counter keep its documents.
	 *
	 * @param id The series to change.
	 * @param input The configuration to change.
	 * @returns The stored series.
	 * @throws BadRequestException when the body states a member this write does not accept.
	 * @throws NotFoundException when the series is not in the caller's scope.
	 */
	async updateSeries(id: ID, input: Partial<ISequence>): Promise<Sequence> {
		await this.findSeriesOrFail(id);

		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		if (stated['key'] !== undefined && stated['key'] !== null) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: a series' key is written once — it is the word every allocation resolves the series by, and renaming it would leave the counter reachable under no name at all.`
			);
		}

		if (stated['channelId'] !== undefined && stated['channelId'] !== null) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: a series' channel is written once — it is the scope its counter belongs to, and moving it would hand one sales surface's numbers to another.`
			);
		}

		for (const member of ['nextValue', 'lastResetAt'] as const) {
			if (stated[member] !== undefined && stated[member] !== null) {
				throw new BadRequestException(
					`${ApiErrorCode.PRECONDITION_REQUIRED}: '${member}' is the series' state rather than its configuration, and an edit does not write it. The next value moves by allocating a number, and backwards only through a restart the series' own policy allows.`
				);
			}
		}

		await this.update(id, {
			...(stated['prefix'] !== undefined ? { prefix: stated['prefix'] } : {}),
			...(stated['padding'] !== undefined ? { padding: stated['padding'] } : {}),
			...(stated['step'] !== undefined ? { step: stated['step'] } : {}),
			...(stated['resetPolicy'] !== undefined ? { resetPolicy: stated['resetPolicy'] } : {}),
			...(stated['description'] !== undefined ? { description: stated['description'] } : {}),
			...(stated['isActive'] !== undefined ? { isActive: stated['isActive'] } : {})
		} as any);

		return this.findSeriesOrFail(id);
	}

	/**
	 * Restarts a series, when its own policy says a restart is due.
	 *
	 * **This is the move the allocator performs, performed on demand — not a column write.** A series
	 * holds both the shape of the numbers it produces and the value the next one will carry, and the
	 * kernel's only operation that moves that value backwards is the restart its `resetPolicy`
	 * describes: the counter is rewound to the value a period starts at, the moment is recorded in
	 * `lastResetAt`, and both are written the way the allocator writes them — read under the same row
	 * lock where the dialect has one, inside the same kind of transaction, and committed with the same
	 * conditional write — so an allocation running beside this one is serialised against it exactly as
	 * it is against the allocator's own restart, and two restarts cannot both rewind a counter.
	 *
	 * **What it refuses is the kernel's own answer, reported rather than overruled.** The restart the
	 * kernel performs is the one `applyResetIfDue` decides, and it performs none in three cases, each
	 * of which this operation states to the caller:
	 *
	 * - the policy is `NEVER`, so the series declares that it never restarts and there is nothing to
	 *   restart;
	 * - no period is recorded for it yet, and the kernel's first contact with a policy records the
	 *   period rather than discarding the counter an operator configured;
	 * - it has already restarted inside the period this moment falls in, and a restart happens at most
	 *   once per period, because a second one would hand out values the period has already handed out.
	 *
	 * **Nothing here refuses while documents of the series exist, because nothing in the kernel could.**
	 * A series is a key, and the domains that number documents from it are not known to it: orders,
	 * returns, purchase orders and stock documents all allocate from their own keys without the series
	 * reading any of their tables. What makes a number unique is the numbered document's own
	 * uniqueness constraint — the enforcement the schema chapter names — and a restart is the
	 * configuration stating that a new period starts counting again, which is a decision about
	 * numbering rather than a defect in it.
	 *
	 * @param id The series to restart.
	 * @param options.at The moment the restart is recorded at; defaults to now. Supplied by tests and
	 * by a seeding or migration path that replays a restart at the moment it happened; both delivered
	 * routes perform the move at the moment it is asked for.
	 * @returns The stored series, rewound, with the restart recorded.
	 * @throws BadRequestException when no restart is due, naming which of the kernel's own reasons
	 * applies.
	 * @throws ConflictException when an allocation or another restart moved the series between this
	 * operation's read and its write, in which case nothing was rewound.
	 * @throws NotFoundException when the series is not in the caller's scope.
	 */
	async resetSeries(id: ID, options: { at?: Date } = {}): Promise<Sequence> {
		const at = options.at ?? new Date();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return this.seriesTransaction(async (manager) => {
			const series = await this.lockSeries(manager, {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			});

			if (!series) {
				throw new NotFoundException(
					`${ApiErrorCode.RESOURCE_NOT_FOUND}: no numbering series '${String(id)}' exists in this organization.`
				);
			}

			// Whether a period was recorded has to be read before the decision, because the kernel's
			// first-contact path records one as it declines to restart. The counter is read for the
			// same reason: the conditional write below is predicated on the value this transaction saw.
			const hadPeriod = Boolean(series.lastResetAt);
			const observedValue = series.nextValue;
			const restarted = this.applyResetIfDue(series, at);

			if (!restarted) {
				throw new BadRequestException(
					`${ApiErrorCode.PRECONDITION_REQUIRED}: no restart is due for the series '${
						series.key
					}' — ${
						series.resetPolicy === SequenceResetPolicy.NEVER
							? 'its reset policy is NEVER, so it never restarts'
							: hadPeriod
							? 'it has already restarted inside the period this moment falls in'
							: 'no period is recorded for it yet, and its next allocation records one without discarding the counter'
					}.`
				);
			}

			// Stamped after the rewind so the restart and its stamp commit together, as they do on the
			// allocation path — the value a period starts at and the record of when it started are one
			// fact, and a row carrying one without the other would restart twice in a period. At the whole
			// second, as the allocation path stamps it: see {@link restartStamp}.
			series.lastResetAt = this.restartStamp(at);

			// Predicated on what this transaction read, for the same reason the allocation is: on the
			// embedded dialects there is no row lock, so an allocation running beside this restart would
			// otherwise be silently rewound over and its number handed out a second time.
			const swapped = await this.swapCounter(manager, series, {
				nextValue: observedValue,
				restartedInto: this.currentPeriodStart(series.resetPolicy, at),
				periodChanged: true
			});

			if (!swapped) {
				throw new ConflictException(
					`${ApiErrorCode.CONCURRENT_MODIFICATION}: the series '${series.key}' was allocated from or restarted while this restart was being applied, so nothing was rewound. Read it again and decide again.`
				);
			}

			// Read back rather than answered from memory, so the caller is handed the row as it was stored
			// — its `updatedAt` included — which is what the `save` this replaced returned.
			return (await this.rereadSeries(manager, series.id)) ?? series;
		});
	}

	/**
	 * Hashes what makes two allocation requests the same request.
	 *
	 * The series and the channel identify the allocation; the moment does not, because a retry sends
	 * a fresh `at` of its own and has to be recognised as the same request all the same. The same key
	 * presented for another series is therefore a reused key rather than a replay.
	 *
	 * @param key The series key.
	 * @param channelId The channel the document belongs to, when the caller stated one.
	 * @returns The hex sha-256 of the canonicalised request.
	 */
	private requestHash(key: string, channelId?: ID): string {
		return createHash('sha256')
			.update(stableStringify({ series: key, channelId: channelId ?? null }))
			.digest('hex');
	}

	/**
	 * Renders a value with the series prefix and padding.
	 *
	 * @param series The series.
	 * @param value The numeric value.
	 * @returns The formatted number.
	 */
	format(series: Pick<Sequence, 'prefix' | 'padding'>, value: number): string {
		const padding = Math.max(0, series.padding ?? 0);
		const digits = String(value).padStart(padding, '0');
		return `${series.prefix ?? ''}${digits}`;
	}

	/**
	 * Reads a series row under a lock where the dialect supports one.
	 *
	 * 🛑 **The channel is filtered explicitly, and that is not a style choice.** The organization-wide
	 * series is the one whose `channelId` is `NULL`, and "no channel" has to be asked for as
	 * `channelId IS NULL`: a `where` that carries `channelId: null` is only translated into that SQL when
	 * the connection declares how to treat a null value, and a query builder that does not falls back to
	 * `channelId = NULL` — which matches nothing, in every dialect, because `NULL = NULL` is unknown
	 * rather than true. That is how the allocator answered "no numbering series is configured" for an
	 * organization that had all seven of them.
	 *
	 * 🛑 **The lock is only requested inside a transaction, and that is not an optimisation.** TypeORM
	 * refuses a pessimistic lock outside one — `SelectQueryBuilder` raises
	 * `PessimisticLockTransactionRequiredError` before the statement reaches the driver — so a reader
	 * that asked for `FOR UPDATE` through the plain repository manager threw instead of reading.
	 * `createSeries` is exactly that reader, so on Postgres and MySQL creating a numbering series
	 * failed outright while the embedded dialects, which never request the lock, were fine.
	 *
	 * @param manager The transaction manager, or the plain entity manager for a read that takes no lock.
	 * @param where The lookup conditions, whose `channelId` member may be an id, `null` for the
	 * organization-wide series, or absent to accept either.
	 * @returns The series, or null.
	 */
	private async lockSeries(manager: any, where: Record<string, unknown>): Promise<Sequence | null> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			return this.lockSeriesOnMikroOrm(manager as MikroOrmEntityManager, where);
		}

		const { channelId, ...scope } = where;

		const query = manager.createQueryBuilder(Sequence, 'sequence').where(scope);

		if (channelId === null) {
			query.andWhere('sequence.channelId IS NULL');
		} else if (channelId !== undefined) {
			query.andWhere('sequence.channelId = :channelId', { channelId });
		}

		// The condition TypeORM itself checks before it issues a pessimistic lock: the manager's own
		// query runner, in an active transaction. The plain repository manager carries no query runner.
		const inTransaction = manager?.queryRunner?.isTransactionActive === true;

		if (inTransaction && (isPostgres() || isMySQL())) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		// The embedded dialects have no row lock — TypeORM answers one there with
		// `LockNotSupportedOnGivenDriverError` — and what makes an allocation safe on them is not this
		// read but the conditional write that follows it: see {@link swapCounter}.
		return query.getOne();
	}

	/**
	 * Writes a series' counter, and only if the row still holds the state the caller decided on.
	 *
	 * This is the half of the allocation that cannot be raced on any dialect. The update is predicated
	 * on the counter the caller read, so a row another writer has already advanced matches nothing and
	 * the answer is "not written" rather than a second write of the same successor.
	 *
	 * 🛑 **A restart is predicated on the period as well as on the counter, because the counter alone
	 * does not always move.** A restart rewinds to `1` and allocates from it, so it leaves the counter at
	 * `1 + step` — and a series that issued exactly one number in the period that ended already holds
	 * `1 + step`. Two restarts racing on such a series would each write the value they both read, both
	 * swaps would match, and both would hand out `1`. The second condition is the premise the restart
	 * was decided on — no restart recorded since the period began — and the first restart to commit is
	 * what makes it false for the other.
	 *
	 * The period is written only when the caller changed it, so an allocation that neither restarted
	 * nor recorded a first period never writes back a `lastResetAt` another writer has since moved on.
	 *
	 * @param manager The transaction manager.
	 * @param series The series as the caller leaves it: its new `nextValue`, and its new `lastResetAt`.
	 * @param observed What the caller read and decided on: the counter; the start of the period it
	 * restarted into, when it restarted; and whether it changed the recorded period at all.
	 * @returns True when the row was written, false when another writer moved it first.
	 */
	private async swapCounter(
		manager: SeriesManager,
		series: Sequence,
		observed: { nextValue: number; restartedInto?: Date; periodChanged: boolean }
	): Promise<boolean> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			return this.swapCounterOnMikroOrm(manager as MikroOrmEntityManager, series, observed);
		}

		const result = await (manager as EntityManager).update(
			Sequence,
			{
				id: series.id,
				nextValue: observed.nextValue,
				...(observed.restartedInto ? { lastResetAt: LessThan(observed.restartedInto) } : {})
			} as any,
			{
				nextValue: series.nextValue,
				...(observed.periodChanged ? { lastResetAt: series.lastResetAt ?? null } : {})
			} as any
		);

		return readAffectedRows(result) === 1;
	}

	/**
	 * The MikroORM arm of {@link lockSeries}: the same lookup, under the same lock, finding the same rows.
	 *
	 * The channel is asked for as the TypeORM arm asks for it: `channelId: null` is `IS NULL` in a MikroORM
	 * criterion — the organization-wide series — an id is compared, and an absent member is not asked about.
	 *
	 * 🛑 **Every other member finds exactly what the TypeORM arm's query builder finds, and that includes
	 * nothing.** The builder takes the scope as `where({...})`, which does not read the connection's
	 * `null: 'sql-null'` setting: a member stated as `null` — an allocation with no tenant or no
	 * organization in its request — is compiled to `= NULL`, which matches no row in any dialect. MikroORM
	 * would read the same member as `IS NULL` and number the tenant's organization-less series, or the
	 * tenant-less ones, for a caller the TypeORM arm refuses. Such a read is answered with no series here
	 * rather than widened: whether the allocator should number a series for such a caller is a decision
	 * both arms take together, and not one this arm may take alone.
	 *
	 * The lock is `FOR UPDATE` on Postgres and MySQL and only inside a transaction, because MikroORM refuses
	 * a pessimistic lock outside one exactly as TypeORM does; the embedded dialects rely on
	 * {@link swapCounter} instead. The read bypasses the identity map, so the counter an allocation decides
	 * on is the stored one and never a copy a context kept.
	 *
	 * @param em The transaction's manager, or the plain one for a read that takes no lock.
	 * @param where The lookup conditions, as {@link lockSeries} takes them.
	 * @returns The series, or null.
	 */
	private async lockSeriesOnMikroOrm(em: MikroOrmEntityManager, where: Record<string, unknown>): Promise<Sequence | null> {
		const { channelId, ...scope } = where;

		if (Object.values(scope).some((value) => value === null || value === undefined)) {
			return null;
		}

		return readSeriesOnMikroOrm(
			em,
			{ ...scope, ...(channelId === undefined ? {} : { channelId }) },
			em.isInTransaction() && (isPostgres() || isMySQL())
		);
	}

	/**
	 * The MikroORM arm of {@link swapCounter}: the same predicate, the same columns, one native update.
	 *
	 * `$lt` is the `LessThan` of the TypeORM arm, and a row whose `lastResetAt` is `NULL` matches neither,
	 * because `NULL < x` is unknown in SQL. The answer is the number of rows the statement changed, which
	 * MikroORM reports as the update's own result. A native update runs no `onUpdate` hook, so the audit
	 * column TypeORM's `update` maintains is stated.
	 *
	 * @param em The transaction's manager.
	 * @param series The series as the caller leaves it.
	 * @param observed What the caller read and decided on.
	 * @returns True when the row was written, false when another writer moved it first.
	 */
	private async swapCounterOnMikroOrm(
		em: MikroOrmEntityManager,
		series: Sequence,
		observed: { nextValue: number; restartedInto?: Date; periodChanged: boolean }
	): Promise<boolean> {
		const written = await em.nativeUpdate(
			Sequence,
			{
				id: series.id,
				nextValue: observed.nextValue,
				...(observed.restartedInto ? { lastResetAt: { $lt: observed.restartedInto } } : {})
			} as FilterQuery<Sequence>,
			{
				nextValue: series.nextValue,
				...(observed.periodChanged ? { lastResetAt: series.lastResetAt ?? null } : {}),
				updatedAt: new Date()
			} as EntityData<Sequence>
		);

		return written === 1;
	}

	/**
	 * The manager a read outside a transaction goes through, on the configured ORM.
	 *
	 * The TypeORM repository's own manager carries no query runner, and MikroORM's plain manager is in no
	 * transaction: on both, {@link lockSeries} therefore reads without a lock.
	 */
	private get seriesManager(): SeriesManager {
		return this.ormType === MultiORMEnum.MikroORM
			? this.mikroOrmSequenceRepository.getEntityManager()
			: this.typeOrmSequenceRepository.manager;
	}

	/**
	 * Runs one allocation or one restart in a transaction of the configured ORM.
	 *
	 * The transaction is what the row lock of {@link lockSeries} lives in on Postgres and MySQL, and what
	 * makes the swap and the read-back one unit on every dialect. The body is handed the transaction's own
	 * manager, which is the manager {@link lockSeries}, {@link swapCounter} and {@link rereadSeries} expect.
	 *
	 * @param work The body.
	 * @returns What the body returned.
	 */
	private seriesTransaction<R>(work: (manager: SeriesManager) => Promise<R>): Promise<R> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			return this.mikroOrmSequenceRepository.getEntityManager().transactional((em) => work(em));
		}

		return this.typeOrmSequenceRepository.manager.transaction((manager) => work(manager));
	}

	/**
	 * Reads one series by its identity and scope, on the configured ORM, taking no lock.
	 *
	 * The criterion is the caller's: `channelId: null` asks for the organization-wide series and a `null`
	 * scope member for a row that carries none, on both arms — TypeORM's connection reads `null` as
	 * `IS NULL` (`null: 'sql-null'`) and MikroORM does so itself. An `undefined` member is left out on both.
	 *
	 * @param where The series' key, channel and scope.
	 * @returns The series, or null.
	 */
	private async findOneSeries(where: Record<string, unknown>): Promise<Sequence | null> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			return readSeriesOnMikroOrm(this.mikroOrmSequenceRepository.getEntityManager(), where, false);
		}

		return this.typeOrmSequenceRepository.findOne({ where: where as any });
	}

	/**
	 * Stores a new series on the configured ORM, and answers the row as stored.
	 *
	 * The MikroORM arm is a native insert stated in full, as the kernel's other MikroORM inserts are:
	 * the scope travels as the `tenant` and `organization` relations, because `tenantId` and
	 * `organizationId` are `relationId` mirrors MikroORM maps `persist: false`; a member that is not a
	 * property of the series is left out, as TypeORM's `create` leaves it out; and the identifier, the
	 * timestamps and the two flags are stated, because the identifier is a column default only on Postgres
	 * and a native insert runs no `onCreate` hook.
	 *
	 * @param values The series' columns.
	 * @returns The stored series.
	 */
	private async insertSeries(values: Partial<Sequence>): Promise<Sequence> {
		if (this.ormType !== MultiORMEnum.MikroORM) {
			return this.typeOrmSequenceRepository.save(this.typeOrmSequenceRepository.create(values));
		}

		const em = this.mikroOrmSequenceRepository.getEntityManager();
		const id = (values.id ?? randomUUID()) as ID;
		const now = new Date();
		const properties = em.getMetadata().get<Sequence>(Sequence.name).properties as Record<string, unknown>;
		const row: Record<string, unknown> = { createdAt: now, updatedAt: now, isActive: true, isArchived: false };

		for (const [column, value] of Object.entries({ ...values, id })) {
			const property = MIKRO_ORM_RELATION_OF_MIRROR[column] ?? column;

			if (value !== undefined && properties[property]) {
				row[property] = value;
			}
		}

		await em.insert(Sequence, row as EntityData<Sequence>);

		const stored = await this.rereadSeries(em, id);

		if (!stored) {
			// Inserted a statement ago; a read that misses it is a store fault, reported as one.
			throw new Error(`The numbering series "${id}" was inserted but could not be read back.`);
		}

		return stored;
	}

	/**
	 * Reads a series back by id, on the configured ORM, through the manager the caller holds.
	 *
	 * @param manager The transaction's manager, or the plain one.
	 * @param id The series id.
	 * @returns The series as stored, or null.
	 */
	private async rereadSeries(manager: SeriesManager, id: ID): Promise<Sequence | null> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			return readSeriesOnMikroOrm(manager as MikroOrmEntityManager, { id }, false);
		}

		return (manager as EntityManager).findOne(Sequence, { where: { id } as any });
	}

	/**
	 * Waits before an allocation that lost its swap reads the series again.
	 *
	 * The pause is jittered so that allocators which read in lockstep stop doing so, and it grows with
	 * the attempts already made, so a counter under sustained contention is read less often rather
	 * than more.
	 *
	 * @param attemptsMade How many attempts have already lost.
	 */
	private pauseBeforeRetry(attemptsMade: number): Promise<void> {
		const delay = Math.floor(Math.random() * SequenceService.ALLOCATION_RETRY_JITTER_MS * attemptsMade);

		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	/**
	 * The moment a restart is recorded at: the moment it happened, to the whole second.
	 *
	 * 🛑 **The fraction is dropped here because MySQL would round it, and rounding can cross a period.**
	 * `lastResetAt` is a `datetime` with no fractional precision on MySQL, the driver sends the milliseconds
	 * a `Date` carries, and MySQL rounds a value it cannot hold exactly rather than truncating it. A restart
	 * at `23:59:59.700` was therefore stored as the next day's `00:00:00`, and every later decision —
	 * `applyResetIfDue` in memory and the `lastResetAt < periodStart` predicate of {@link swapCounter} —
	 * read a restart recorded inside the next period: its first allocation took no restart, and a `DAILY`
	 * series went on counting from the day before.
	 *
	 * Truncating before the write, on every dialect, is the smaller of the two fixes and the more complete
	 * one. A whole second is stored exactly by all four dialects, so the row says the same thing wherever it
	 * lives, and it never leaves the period it was taken in, because every period starts on a whole second.
	 * Widening the column to `datetime(6)` would need a MySQL-only migration and an entity precision that
	 * only one dialect reads, and would still leave `lastResetAt` depending on the column's declared
	 * precision rather than on the service that decides by it. Nothing is lost: the stamp records which
	 * period the series last restarted in, and no decision reads it at a finer grain than a second.
	 *
	 * @param at The moment of the restart.
	 * @returns That moment, with its fraction of a second dropped.
	 */
	private restartStamp(at: Date): Date {
		return new Date(Math.floor(at.getTime() / 1000) * 1000);
	}

	/**
	 * Restarts a series when its policy says a period has elapsed.
	 *
	 * @param series The series, mutated in place.
	 * @param at The moment of allocation.
	 * @returns True when the series was restarted.
	 */
	private applyResetIfDue(series: Sequence, at: Date): boolean {
		if (!series.resetPolicy || series.resetPolicy === SequenceResetPolicy.NEVER) {
			return false;
		}

		const boundary = this.currentPeriodStart(series.resetPolicy, at);

		if (!series.lastResetAt) {
			// First allocation after the policy was introduced: start the period now rather than
			// restarting and discarding the value that is already configured.
			series.lastResetAt = boundary;
			return false;
		}

		if (new Date(series.lastResetAt).getTime() >= boundary.getTime()) {
			return false;
		}

		series.nextValue = 1;
		return true;
	}

	/**
	 * The start of the period a moment falls in.
	 *
	 * **Every part of this is UTC, and that is what makes it correct across daylight saving.** The
	 * boundary is computed from `getUTC*` and compared against `lastResetAt` as epoch milliseconds, so
	 * there is no local-time arithmetic anywhere: a period never gains or loses an hour, and a `DAILY`
	 * series neither sees one local midnight twice on the day a clock goes back nor skips one on the
	 * day it goes forward.
	 *
	 * **What it does not do is honour an organization's own day**, and that is a limitation rather
	 * than an oversight. A `DAILY` series for an organization in UTC+13 restarts at 13:00 local, and a
	 * `MONTHLY` one restarts thirteen hours into the first of the month. Fixing that needs the series
	 * to carry the zone its period is measured in — a column, and therefore a migration — and until it
	 * does, periods are UTC periods.
	 *
	 * @param policy The restart policy.
	 * @param at The reference moment.
	 * @returns The start of the UTC period `at` falls in.
	 */
	private currentPeriodStart(policy: SequenceResetPolicy, at: Date): Date {
		const year = at.getUTCFullYear();
		const month = at.getUTCMonth();

		switch (policy) {
			case SequenceResetPolicy.YEARLY:
				return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
			case SequenceResetPolicy.MONTHLY:
				return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
			case SequenceResetPolicy.DAILY:
				return new Date(Date.UTC(year, month, at.getUTCDate(), 0, 0, 0, 0));
			default:
				return new Date(0);
		}
	}
}
