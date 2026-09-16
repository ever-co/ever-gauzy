import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isBetterSqlite3, isMySQL, isPostgres } from '@gauzy/config';
import { IAllocatedNumber, ID, ISequence, SequenceResetPolicy } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { Sequence } from './sequence.entity';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

/**
 * Allocates human-facing document numbers from a series.
 *
 * Every allocation is serialized against the series row so two concurrent writers can never be
 * handed the same value. Where the dialect supports row locks the read takes one; on the embedded
 * dialect, which serializes writers at the file level, the read-then-update pair inside a
 * transaction is already exclusive.
 */
@Injectable()
export class SequenceService extends CrudService<Sequence> {
	constructor(
		readonly typeOrmSequenceRepository: TypeOrmSequenceRepository,
		readonly mikroOrmSequenceRepository: MikroOrmSequenceRepository
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
	 * @returns The allocated number, formatted and raw.
	 */
	async allocate(key: string, options: { channelId?: ID; at?: Date } = {}): Promise<IAllocatedNumber> {
		const at = options.at ?? new Date();

		return this.typeOrmSequenceRepository.manager.transaction(async (manager) => {
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

			return {
				formatted: this.format(series, allocatedValue),
				value: allocatedValue,
				key: series.key
			};
		});
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
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

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
			tenantId,
			organizationId,
			padding: input.padding ?? 6,
			step: input.step ?? 1,
			nextValue: input.nextValue ?? 1,
			resetPolicy: input.resetPolicy ?? SequenceResetPolicy.NEVER
		} as Partial<Sequence>);

		return this.typeOrmSequenceRepository.save(created);
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
	 * @param manager The transaction manager.
	 * @param where The lookup conditions.
	 * @returns The series, or null.
	 */
	private async lockSeries(manager: any, where: Record<string, unknown>): Promise<Sequence | null> {
		const query = manager.createQueryBuilder(Sequence, 'sequence').where(where);

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
