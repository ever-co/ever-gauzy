/**
 * Allocates the human-facing numbers of the inventory documents.
 *
 * The series themselves are the platform’s: the same `sequence` rows every other numbered document
 * is drawn from, so a transfer and an order that share a series key would share a counter rather
 * than each starting at one. Allocation takes a row lock on the series, which is what stops two
 * concurrent writers being handed the same number, and it creates the series on first use so an
 * installation that has not seeded one still numbers its documents instead of refusing the write.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { RequestContext, Sequence } from '@gauzy/core';
import { DatabaseTypeEnum } from '@gauzy/config';

/** Default width of an allocated number, matching the platform’s document numbers. */
const DEFAULT_PADDING = 6;

/** An allocated number, formatted and raw. */
export interface IAllocatedInventoryNumber {
	readonly key: string;
	readonly value: number;
	readonly formatted: string;
}

/**
 * Allocates document numbers from the platform’s numbering series.
 */
@Injectable()
export class InventorySequenceService {
	constructor(@InjectRepository(Sequence) private readonly sequenceRepository: Repository<Sequence>) {}

	/**
	 * Allocates the next value of a series, creating the series when it does not exist yet.
	 *
	 * @param key the series key, for example `TRANSFER` or `STOCK_COUNT`.
	 * @param at the moment of allocation; supplied by imports that replay historical documents.
	 */
	public async allocate(key: string, at: Date = new Date()): Promise<IAllocatedInventoryNumber> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.sequenceRepository.manager.transaction(async (manager) => {
			const series =
				(await this.lockSeries(manager, key, tenantId, organizationId)) ??
				(await this.createSeries(manager, key, tenantId, organizationId));

			const value = Number(series.nextValue ?? 1);
			series.nextValue = value + Number(series.step ?? 1);
			if (this.resetDue(series, at)) {
				series.lastResetAt = at;
			}
			await manager.save(Sequence, series);

			return { key, value, formatted: this.format(series, value) };
		});
	}

	/** Reads a series under a row lock where the dialect has one. */
	private async lockSeries(
		manager: any,
		key: string,
		tenantId: string,
		organizationId: string
	): Promise<Sequence | null> {
		const dialect = manager.connection.options.type as DatabaseTypeEnum;
		const query = manager
			.createQueryBuilder(Sequence, 'sequence')
			.where('sequence.key = :key', { key })
			.andWhere('sequence.tenantId = :tenantId', { tenantId })
			.andWhere('sequence.organizationId = :organizationId', { organizationId })
			.andWhere('sequence.channelId IS NULL');

		if (dialect === DatabaseTypeEnum.postgres || dialect === DatabaseTypeEnum.mysql) {
			return await query.setLock('pessimistic_write').getOne();
		}
		// The embedded dialect serialises writers, so the surrounding transaction is already exclusive.
		return await query.getOne();
	}

	/** Creates a series on first use, so a missing seed cannot stop a document being numbered. */
	private async createSeries(
		manager: any,
		key: string,
		tenantId: string,
		organizationId: string
	): Promise<Sequence> {
		const series = manager.create(Sequence, {
			key,
			padding: DEFAULT_PADDING,
			step: 1,
			nextValue: 1,
			tenantId,
			organizationId
		} as Partial<Sequence>);
		return await manager.save(Sequence, series);
	}

	/** Renders a value with the series prefix and padding. */
	private format(series: Sequence, value: number): string {
		const padding = Math.max(0, Number(series.padding ?? 0));
		return `${series.prefix ?? ''}${String(value).padStart(padding, '0')}`;
	}

	/** Whether the series is due to restart, which an allocation records without discarding the value. */
	private resetDue(series: Sequence, at: Date): boolean {
		if (!series.lastResetAt) {
			return false;
		}
		return new Date(series.lastResetAt).getTime() > at.getTime();
	}
}
