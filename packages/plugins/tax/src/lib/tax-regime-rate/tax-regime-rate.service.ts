import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxRegimeRate } from './tax-regime-rate.entity';
import { MikroOrmTaxRegimeRateRepository } from './repository/mikro-orm-tax-regime-rate.repository';
import { TypeOrmTaxRegimeRateRepository } from './repository/type-orm-tax-regime-rate.repository';

/**
 * The membership rows that attach rates to a regime.
 *
 * A pivot, and the whole of the regime mechanism: the presence of a row is what makes a rate
 * regime-specific, and its absence is what keeps the rate general. Because the row has no independent
 * lifecycle, the service exposes the membership of one regime, the membership of a set of rates (which
 * is what the resolution reads) and the replacement of one regime's set — never a free-standing edit of
 * a single row, which would let a caller detach a rate from a regime it is not looking at.
 *
 * The rows are hard-deleted when a rate is removed from a regime. That is deliberate and is the one
 * place in the tax package where a delete is not a soft delete: a membership is not evidence of
 * anything, nothing snapshots it, and a soft-deleted row would have to be filtered out of every
 * resolution read to say what the current membership is. What a document was taxed under is snapshotted
 * on the tax line (`taxRegimeId`), not here.
 */
@Injectable()
export class TaxRegimeRateService extends TenantAwareCrudService<TaxRegimeRate> {
	constructor(
		readonly typeOrmTaxRegimeRateRepository: TypeOrmTaxRegimeRateRepository,
		readonly mikroOrmTaxRegimeRateRepository: MikroOrmTaxRegimeRateRepository
	) {
		super(typeOrmTaxRegimeRateRepository, mikroOrmTaxRegimeRateRepository);
	}

	/**
	 * Reads the membership of one regime.
	 *
	 * @param taxRegimeId The regime to read.
	 * @returns The membership rows of the regime.
	 */
	public async listByRegime(taxRegimeId: ID): Promise<TaxRegimeRate[]> {
		return await this.typeOrmTaxRegimeRateRepository.find({
			where: { taxRegimeId, organizationId: RequestContext.currentOrganizationId() }
		});
	}

	/**
	 * Reads the membership rows of a set of rates.
	 *
	 * This is the read the resolution is built on: a rate with no row of its own is general, and a rate
	 * with at least one is a candidate only when one of its regimes is the selected one.
	 *
	 * @param taxRateIds The rates to read.
	 * @returns Every membership row of every named rate.
	 */
	public async listByRates(taxRateIds: ID[]): Promise<TaxRegimeRate[]> {
		if (!taxRateIds.length) {
			return [];
		}

		return await this.typeOrmTaxRegimeRateRepository.find({
			where: { taxRateId: In(taxRateIds), organizationId: RequestContext.currentOrganizationId() }
		});
	}

	/**
	 * Replaces the rate membership of one regime with the supplied set.
	 *
	 * @param taxRegimeId The regime whose membership is being written.
	 * @param taxRateIds The complete set of rates the regime should select.
	 * @returns The membership rows after the write.
	 * @throws BadRequestException when the set names the same rate twice, when it is empty — a regime
	 * that selects nothing is a silently untaxed jurisdiction rather than a configuration — or when a
	 * named rate is not one of the organization's.
	 */
	public async replaceForRegime(taxRegimeId: ID, taxRateIds: ID[]): Promise<TaxRegimeRate[]> {
		if (!taxRateIds?.length) {
			throw new BadRequestException(
				'TAX_REGIME_EMPTY: a regime has to select at least one rate, because a regime that selects nothing leaves a jurisdiction untaxed.'
			);
		}
		if (new Set(taxRateIds).size !== taxRateIds.length) {
			throw new BadRequestException('A rate belongs to a regime once.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmTaxRegimeRateRepository.find({ where: { taxRegimeId } });
		const kept = new Set(taxRateIds);
		const removed = existing.filter((row) => !kept.has(row.taxRateId));

		await this.typeOrmTaxRegimeRateRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(
					TaxRegimeRate,
					removed.map((row) => row.id)
				);
			}

			for (const taxRateId of taxRateIds) {
				if (existing.some((row) => row.taxRateId === taxRateId)) {
					continue;
				}

				await manager.insert(TaxRegimeRate, {
					taxRegimeId,
					taxRateId,
					organizationId,
					tenantId
				} as DeepPartial<TaxRegimeRate>);
			}
		});

		return await this.listByRegime(taxRegimeId);
	}

	/**
	 * Removes one rate from one regime.
	 *
	 * @param taxRegimeId The regime.
	 * @param taxRateId The rate to detach.
	 * @returns The membership rows after the write.
	 */
	public async removeFromRegime(taxRegimeId: ID, taxRateId: ID): Promise<TaxRegimeRate[]> {
		const row = await this.typeOrmTaxRegimeRateRepository.findOne({ where: { taxRegimeId, taxRateId } });

		if (row) {
			await this.typeOrmTaxRegimeRateRepository.delete(row.id);
		}

		return await this.listByRegime(taxRegimeId);
	}
}
