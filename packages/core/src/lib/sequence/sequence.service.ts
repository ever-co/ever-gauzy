import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { isBetterSqlite3, isMySQL, isPostgres } from '@gauzy/config';
import { IAllocatedNumber, ID, ISequence, IdempotencyOutcome, JsonData, SequenceResetPolicy } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
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
