import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { isBetterSqlite3, isMySQL, isPostgres } from '@gauzy/config';
import { IAllocatedNumber, ID, ISequence, IdempotencyOutcome, JsonData, SequenceResetPolicy } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
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
 * Allocates human-facing document numbers from a series.
 *
 * Every allocation is serialized against the series row so two concurrent writers can never be
 * handed the same value. Where the dialect supports row locks the read takes one; on the embedded
 * dialect, which serializes writers at the file level, the read-then-update pair inside a
 * transaction is already exclusive.
 *
 * An allocation may also be claimed under an idempotency key, which is what makes a retried request
 * cost the series nothing: the retry is answered with the number the first attempt allocated instead
 * of consuming a second one.
 */
@Injectable()
export class SequenceService extends CrudService<Sequence> {
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
			const channelSeries = await this.typeOrmSequenceRepository.findOne({
				where: { key, channelId, tenantId, organizationId } as any
			});

			if (channelSeries) {
				return channelSeries;
			}
		}

		const organizationSeries = await this.typeOrmSequenceRepository.findOne({
			where: { key, channelId: null as any, tenantId, organizationId } as any
		});

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

		const allocated = await this.typeOrmSequenceRepository.manager.transaction(async (manager) => {
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

			const restarted = this.applyResetIfDue(series, at);
			const allocatedValue = series.nextValue;

			series.nextValue = allocatedValue + (series.step ?? 1);

			await manager.save(Sequence, series);

			if (restarted) {
				// Recorded after the save so the restart and the allocation commit together.
				series.lastResetAt = at;
				await manager.save(Sequence, series);
			}

			seriesId = series.id;

			return {
				formatted: this.format(series, allocatedValue),
				value: allocatedValue,
				key: series.key
			};
		});

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

		const existing = await this.typeOrmSequenceRepository.findOne({
			where: {
				key: input.key,
				channelId: (input.channelId ?? null) as any,
				tenantId,
				organizationId
			} as any
		});

		if (existing) {
			return existing;
		}

		const created = this.typeOrmSequenceRepository.create({
			...input,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {}),
			padding: input.padding ?? 6,
			step: input.step ?? 1,
			nextValue: input.nextValue ?? 1,
			resetPolicy: input.resetPolicy ?? SequenceResetPolicy.NEVER
		} as Partial<Sequence>);

		return this.typeOrmSequenceRepository.save(created);
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
		// `IS NULL`, because `channelId = NULL` matches nothing in any dialect. Outside a transaction
		// the lock that reader states is inert, which is why the unique indexes carry the guarantee.
		const existing = await this.lockSeries(this.typeOrmSequenceRepository.manager, {
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
		const created = this.typeOrmSequenceRepository.create({
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

		return this.typeOrmSequenceRepository.save(created);
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
	 * `lastResetAt`, and both are written under the same row lock the allocator takes and inside the
	 * same kind of transaction — so an allocation running beside this one is serialised against it
	 * exactly as it is against the allocator's own restart, and two restarts cannot both rewind a
	 * counter.
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
	 * @throws NotFoundException when the series is not in the caller's scope.
	 */
	async resetSeries(id: ID, options: { at?: Date } = {}): Promise<Sequence> {
		const at = options.at ?? new Date();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return this.typeOrmSequenceRepository.manager.transaction(async (manager) => {
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
			// first-contact path records one as it declines to restart.
			const hadPeriod = Boolean(series.lastResetAt);
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
			// fact, and a row carrying one without the other would restart twice in a period.
			series.lastResetAt = at;

			return manager.save(Sequence, series);
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
	 * @param manager The transaction manager.
	 * @param where The lookup conditions, whose `channelId` member may be an id, `null` for the
	 * organization-wide series, or absent to accept either.
	 * @returns The series, or null.
	 */
	private async lockSeries(manager: any, where: Record<string, unknown>): Promise<Sequence | null> {
		const { channelId, ...scope } = where;

		const query = manager.createQueryBuilder(Sequence, 'sequence').where(scope);

		if (channelId === null) {
			query.andWhere('sequence.channelId IS NULL');
		} else if (channelId !== undefined) {
			query.andWhere('sequence.channelId = :channelId', { channelId });
		}

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		if (isBetterSqlite3()) {
			// The embedded dialect serializes writers, so the surrounding transaction is the lock.
			return query.getOne();
		}

		return query.getOne();
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
	 * @param policy The restart policy.
	 * @param at The reference moment.
	 * @returns The start of the period `at` falls in.
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
